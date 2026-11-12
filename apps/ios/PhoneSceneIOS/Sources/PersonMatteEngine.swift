import Foundation
import CoreVideo
import Vision

/// On-device person soft-alpha via Vision (Neural Engine).
/// No empty-background plate — safe while the user / phone moves.
final class PersonMatteEngine {
    private let request: VNGeneratePersonSegmentationRequest = {
        let r = VNGeneratePersonSegmentationRequest()
        r.qualityLevel = .balanced
        r.outputPixelFormat = kCVPixelFormatType_OneComponent8
        return r
    }()

    private let workQueue = DispatchQueue(label: "phonescene.personmatte", qos: .userInitiated)
    private var busy = false
    private var lastRunAt: CFAbsoluteTime = 0
    /// ~15 Hz alpha is enough; RGB stays at camera rate.
    private let minInterval: CFAbsoluteTime = 1.0 / 15.0

    /// Async matte; callback may be off-main.
    func generateMatte(from pixelBuffer: CVPixelBuffer, completion: @escaping (CVPixelBuffer?) -> Void) {
        let now = CFAbsoluteTimeGetCurrent()
        guard !busy, now - lastRunAt >= minInterval else {
            completion(nil)
            return
        }
        busy = true
        lastRunAt = now
        workQueue.async { [weak self] in
            guard let self else {
                completion(nil)
                return
            }
            defer { self.busy = false }
            let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, options: [:])
            do {
                try handler.perform([self.request])
                guard let mask = self.request.results?.first?.pixelBuffer else {
                    completion(nil)
                    return
                }
                completion(Self.maskToBGRA(mask))
            } catch {
                completion(nil)
            }
        }
    }

    /// WebRTC-friendly BGRA where RGB = alpha, A = 255.
    private static func maskToBGRA(_ mask: CVPixelBuffer) -> CVPixelBuffer? {
        CVPixelBufferLockBaseAddress(mask, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(mask, .readOnly) }

        let w = CVPixelBufferGetWidth(mask)
        let h = CVPixelBufferGetHeight(mask)
        let srcBytes = CVPixelBufferGetBytesPerRow(mask)
        guard let srcBase = CVPixelBufferGetBaseAddress(mask) else { return nil }

        var out: CVPixelBuffer?
        let attrs: [CFString: Any] = [
            kCVPixelBufferCGImageCompatibilityKey: true,
            kCVPixelBufferCGBitmapContextCompatibilityKey: true,
        ]
        let status = CVPixelBufferCreate(
            kCFAllocatorDefault,
            w,
            h,
            kCVPixelFormatType_32BGRA,
            attrs as CFDictionary,
            &out
        )
        guard status == kCVReturnSuccess, let dst = out else { return nil }

        CVPixelBufferLockBaseAddress(dst, [])
        defer { CVPixelBufferUnlockBaseAddress(dst, []) }
        guard let dstBase = CVPixelBufferGetBaseAddress(dst) else { return nil }
        let dstBytes = CVPixelBufferGetBytesPerRow(dst)

        for y in 0 ..< h {
            let sRow = srcBase.advanced(by: y * srcBytes).assumingMemoryBound(to: UInt8.self)
            let dRow = dstBase.advanced(by: y * dstBytes).assumingMemoryBound(to: UInt8.self)
            for x in 0 ..< w {
                let a = sRow[x]
                let o = x * 4
                dRow[o] = a // B
                dRow[o + 1] = a // G
                dRow[o + 2] = a // R
                dRow[o + 3] = 255
            }
        }
        return dst
    }
}
