import Foundation
import ImageIO
import Vision

struct OCRError: Error, CustomStringConvertible {
    let description: String
}

func makePayload(text: String, lines: [String], items: [[String: Any]] = [], error: String? = nil) throws -> Data {
    var payload: [String: Any] = [
        "text": text,
        "lines": lines,
        "items": items,
    ]
    if let error {
        payload["error"] = error
    }
    return try JSONSerialization.data(withJSONObject: payload, options: [])
}

do {
    guard CommandLine.arguments.count >= 2 else {
        throw OCRError(description: "image path is required")
    }

    let imageURL = URL(fileURLWithPath: CommandLine.arguments[1])
    guard let source = CGImageSourceCreateWithURL(imageURL as CFURL, nil),
          let originalImage = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        throw OCRError(description: "could not read image pixels")
    }
    let cgImage = resizeForVision(originalImage) ?? originalImage

    let observations = try recognizeText(in: cgImage)
    let recognized = observations
        .compactMap { observation -> (String, CGRect)? in
            guard let text = observation.topCandidates(1).first?.string.trimmingCharacters(in: .whitespacesAndNewlines),
                  !text.isEmpty else {
                return nil
            }
            return (text, observation.boundingBox)
        }
        .sorted { left, right in
            if abs(left.1.midY - right.1.midY) > 0.012 {
                return left.1.midY > right.1.midY
            }
            return left.1.minX < right.1.minX
        }
    let lines = recognized.map { $0.0 }
    let items = recognized.map { text, box in
        [
            "text": text,
            "x": box.minX,
            "y": box.midY,
            "w": box.width,
            "h": box.height,
        ] as [String : Any]
    }

    FileHandle.standardOutput.write(try makePayload(text: lines.joined(separator: "\n"), lines: lines, items: items))
} catch {
    let data = try makePayload(text: "", lines: [], error: String(describing: error))
    FileHandle.standardOutput.write(data)
    exit(2)
}

func resizeForVision(_ image: CGImage) -> CGImage? {
    let maxSide = 2200.0
    let width = Double(image.width)
    let height = Double(image.height)
    let longest = max(width, height)
    guard longest > maxSide else {
        return image
    }

    let scale = maxSide / longest
    let newWidth = max(1, Int(width * scale))
    let newHeight = max(1, Int(height * scale))
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    guard let context = CGContext(
        data: nil,
        width: newWidth,
        height: newHeight,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else {
        return nil
    }
    context.interpolationQuality = .high
    context.draw(image, in: CGRect(x: 0, y: 0, width: newWidth, height: newHeight))
    return context.makeImage()
}

func recognizeText(in image: CGImage) throws -> [VNRecognizedTextObservation] {
    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    let preferredLanguages = ["ko-KR", "ja-JP", "en-US"]

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    if let supported = try? request.supportedRecognitionLanguages() {
        let preferred = preferredLanguages.filter { supported.contains($0) }
        if !preferred.isEmpty {
            request.recognitionLanguages = preferred
        }
    }
    request.minimumTextHeight = 0.006

    do {
        try handler.perform([request])
        return request.results ?? []
    } catch {
        let fallback = VNRecognizeTextRequest()
        fallback.recognitionLevel = .accurate
        fallback.usesLanguageCorrection = false
        fallback.minimumTextHeight = 0.006
        try VNImageRequestHandler(cgImage: image, options: [:]).perform([fallback])
        return fallback.results ?? []
    }
}
