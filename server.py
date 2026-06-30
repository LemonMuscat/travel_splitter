#!/usr/bin/env python3
import cgi
import csv
import io
import json
import os
import subprocess
import tempfile
import zipfile
from datetime import datetime, timedelta
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parent
SWIFT_HELPER = ROOT / "ocr.swift"
MODULE_CACHE = ROOT / ".swift-module-cache"


class TravelSplitterHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        if self.path == "/api/ocr":
            handler = self.handle_ocr
        elif self.path == "/api/import-ledger":
            handler = self.handle_ledger_import
        else:
            self.send_error(404)
            return
        try:
            result = handler()
        except Exception as exc:
            self.send_response(500)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(exc)}, ensure_ascii=False).encode("utf-8"))
            return

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))

    def handle_ocr(self):
        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": self.headers.get("Content-Type", ""),
            },
        )
        field = form["image"] if "image" in form else None
        if field is None or not field.file:
            raise ValueError("image file is required")

        suffix = Path(field.filename or "upload.png").suffix or ".png"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as handle:
            image_path = Path(handle.name)
            handle.write(field.file.read())

        try:
            env = os.environ.copy()
            env["CLANG_MODULE_CACHE_PATH"] = str(MODULE_CACHE)
            MODULE_CACHE.mkdir(exist_ok=True)
            completed = subprocess.run(
                ["swift", str(SWIFT_HELPER), str(image_path)],
                cwd=str(ROOT),
                env=env,
                text=True,
                capture_output=True,
                check=True,
                timeout=45,
            )
            return json.loads(completed.stdout)
        finally:
            try:
                image_path.unlink()
            except OSError:
                pass

    def handle_ledger_import(self):
        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": self.headers.get("Content-Type", ""),
            },
        )
        field = form["file"] if "file" in form else None
        if field is None or not field.file:
            raise ValueError("ledger file is required")

        filename = field.filename or "ledger"
        suffix = Path(filename).suffix.lower()
        content = field.file.read()

        if suffix == ".xlsx":
            rows = parse_xlsx(content)
        elif suffix == ".csv":
            rows = parse_delimited(content, ",")
        elif suffix == ".tsv":
            rows = parse_delimited(content, "\t")
        else:
            raise ValueError("supported formats: .xlsx, .csv, .tsv")

        return {"filename": filename, "rows": rows, "text": rows_to_tsv(rows)}


def main():
    port = int(os.environ.get("PORT", "4173"))
    server = ThreadingHTTPServer(("127.0.0.1", port), TravelSplitterHandler)
    print(f"Travel splitter running at http://127.0.0.1:{port}")
    server.serve_forever()


def parse_delimited(content, delimiter):
    text = content.decode("utf-8-sig")
    return [row for row in csv.reader(io.StringIO(text), delimiter=delimiter) if any(cell.strip() for cell in row)]


def parse_xlsx(content):
    with zipfile.ZipFile(io.BytesIO(content)) as workbook:
        shared_strings = read_shared_strings(workbook)
        sheet_path = first_sheet_path(workbook)
        sheet_xml = workbook.read(sheet_path)
        return normalize_xlsx_rows(read_sheet_rows(sheet_xml, shared_strings))


def read_shared_strings(workbook):
    try:
        xml = workbook.read("xl/sharedStrings.xml")
    except KeyError:
        return []
    root = ElementTree.fromstring(xml)
    values = []
    for item in root:
        parts = []
        for text in item.iter():
            if text.tag.endswith("}t") or text.tag == "t":
                parts.append(text.text or "")
        values.append("".join(parts))
    return values


def first_sheet_path(workbook):
    workbook_root = ElementTree.fromstring(workbook.read("xl/workbook.xml"))
    rels_root = ElementTree.fromstring(workbook.read("xl/_rels/workbook.xml.rels"))
    first_sheet = next(node for node in workbook_root.iter() if node.tag.endswith("}sheet") or node.tag == "sheet")
    rel_id = first_sheet.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
    for rel in rels_root:
        if rel.attrib.get("Id") == rel_id:
            target = rel.attrib["Target"]
            return "xl/" + target.lstrip("/")
    raise ValueError("could not find first worksheet")


def read_sheet_rows(sheet_xml, shared_strings):
    root = ElementTree.fromstring(sheet_xml)
    rows = []
    for row_node in root.iter():
        if not (row_node.tag.endswith("}row") or row_node.tag == "row"):
            continue
        row = []
        for cell in row_node:
            if not (cell.tag.endswith("}c") or cell.tag == "c"):
                continue
            ref = cell.attrib.get("r", "")
            col_index = column_index(ref)
            while len(row) < col_index:
                row.append("")
            row.append(cell_value(cell, shared_strings))
        if any(str(cell).strip() for cell in row):
            rows.append(row)
    return rows


def column_index(ref):
    letters = "".join(ch for ch in ref if ch.isalpha())
    value = 0
    for ch in letters:
        value = value * 26 + ord(ch.upper()) - ord("A") + 1
    return max(value - 1, 0)


def cell_value(cell, shared_strings):
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.iter() if node.tag.endswith("}t") or node.tag == "t")
    value_node = next((node for node in cell if node.tag.endswith("}v") or node.tag == "v"), None)
    if value_node is None:
        return ""
    raw = value_node.text or ""
    if cell_type == "s":
        try:
            return shared_strings[int(raw)]
        except Exception:
            return raw
    return raw


def rows_to_tsv(rows):
    return "\n".join("\t".join(str(cell) for cell in row) for row in rows)


def normalize_xlsx_rows(rows):
    if not rows:
        return rows
    header = [str(cell).replace(" ", "") for cell in rows[0]]
    try:
        date_index = header.index("날짜")
    except ValueError:
        return rows
    normalized = [rows[0]]
    for row in rows[1:]:
        row = list(row)
        if date_index < len(row):
            row[date_index] = excel_date_to_text(row[date_index])
        normalized.append(row)
    return normalized


def excel_date_to_text(value):
    text = str(value or "").strip()
    try:
        serial = float(text)
    except ValueError:
        return text
    if serial < 20000:
        return text
    date = datetime(1899, 12, 30) + timedelta(days=serial)
    return date.strftime("%Y. %m. %d %H:%M:%S")


if __name__ == "__main__":
    main()
