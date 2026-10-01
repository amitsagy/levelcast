// Renders the site's "after" minute through the same audio chain the app
// plays podcasts with (LevelCast/Audio/LevelingEngine.swift):
//
//   player -> HighPassFilter -> DynamicsProcessor -> PeakLimiter -> mixer
//
// using Apple's audio units in offline (manual) rendering, with the parameter
// values copied from LevelCast/Models/LevelingPreset.swift. If those values
// change in the app, change them here and re-render.
//
// Then measures both files the same way the original demo was measured:
//   gap     = mean dB of the loudest third minus the quietest third of 2 s
//             RMS windows (windows under -60 dBFS dropped), left channel;
//   overall = plain RMS of the whole left channel, in dBFS.
//
//   xcrun swift scripts/demo/render-levelling.swift raw/demo/before.wav raw/demo/after.wav [normal|strong]

import AVFoundation
import AudioToolbox

struct Preset {
    let highPassHz, thresholdDB, headRoomDB, attack, release, makeupDB, limiterPreGainDB, limiterAttack, limiterDecay: Float
}
// Copied from LevelingPreset.swift.
let presets: [String: Preset] = [
    "normal": Preset(highPassHz: 100, thresholdDB: -41, headRoomDB: 40, attack: 0.05, release: 0.2, makeupDB: 3, limiterPreGainDB: 11, limiterAttack: 0.002, limiterDecay: 0.005),
    "strong": Preset(highPassHz: 120, thresholdDB: -50, headRoomDB: 40, attack: 0.02, release: 0.35, makeupDB: 5, limiterPreGainDB: 16, limiterAttack: 0.002, limiterDecay: 0.02),
]

let args = CommandLine.arguments
let inURL = URL(fileURLWithPath: args[1]), outURL = URL(fileURLWithPath: args[2])
let p = presets[args.count > 3 ? args[3] : "normal"]!

func effect(_ sub: OSType) -> AVAudioUnitEffect {
    AVAudioUnitEffect(audioComponentDescription: AudioComponentDescription(
        componentType: kAudioUnitType_Effect, componentSubType: sub,
        componentManufacturer: kAudioUnitManufacturer_Apple, componentFlags: 0, componentFlagsMask: 0))
}
func set(_ u: AVAudioUnitEffect, _ id: AudioUnitParameterID, _ v: Float) {
    AudioUnitSetParameter(u.audioUnit, id, kAudioUnitScope_Global, 0, v, 0)
}

let file = try AVAudioFile(forReading: inURL)
let format = AVAudioFormat(standardFormatWithSampleRate: 44_100, channels: 2)!  // the app's canonical format
let engine = AVAudioEngine()
let player = AVAudioPlayerNode()
let highPass = effect(kAudioUnitSubType_HighPassFilter)
let compressor = effect(kAudioUnitSubType_DynamicsProcessor)
let limiter = effect(kAudioUnitSubType_PeakLimiter)
for n in [player, highPass, compressor, limiter] { engine.attach(n) }
let chain: [AVAudioNode] = [player, highPass, compressor, limiter, engine.mainMixerNode]
for (a, b) in zip(chain, chain.dropFirst()) { engine.connect(a, to: b, format: format) }

set(highPass, kHipassParam_CutoffFrequency, p.highPassHz)
set(highPass, kHipassParam_Resonance, 0)
set(compressor, kDynamicsProcessorParam_Threshold, p.thresholdDB)
set(compressor, kDynamicsProcessorParam_HeadRoom, p.headRoomDB)
set(compressor, kDynamicsProcessorParam_AttackTime, p.attack)
set(compressor, kDynamicsProcessorParam_ReleaseTime, p.release)
set(compressor, kDynamicsProcessorParam_ExpansionRatio, 1)
set(compressor, kDynamicsProcessorParam_OverallGain, p.makeupDB)
set(limiter, kLimiterParam_PreGain, p.limiterPreGainDB)
set(limiter, kLimiterParam_AttackTime, p.limiterAttack)
set(limiter, kLimiterParam_DecayTime, p.limiterDecay)

try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 4096)
try engine.start()
player.scheduleFile(file, at: nil)
player.play()

let total = AVAudioFramePosition(Double(file.length) * format.sampleRate / file.processingFormat.sampleRate)
let out = try AVAudioFile(forWriting: outURL, settings: format.settings)
let buffer = AVAudioPCMBuffer(pcmFormat: engine.manualRenderingFormat, frameCapacity: 4096)!
var rendered: [[Float]] = [[], []]
while engine.manualRenderingSampleTime < total {
    let n = min(AVAudioFrameCount(total - engine.manualRenderingSampleTime), buffer.frameCapacity)
    guard try engine.renderOffline(n, to: buffer) == .success else { break }
    try out.write(from: buffer)
    for c in 0..<2 { rendered[c] += Array(UnsafeBufferPointer(start: buffer.floatChannelData![c], count: Int(buffer.frameLength))) }
}
engine.stop()

func readLeft(_ url: URL) throws -> [Float] {
    let f = try AVAudioFile(forReading: url)
    let b = AVAudioPCMBuffer(pcmFormat: f.processingFormat, frameCapacity: AVAudioFrameCount(f.length))!
    try f.read(into: b)
    return Array(UnsafeBufferPointer(start: b.floatChannelData![0], count: Int(b.frameLength)))
}
func rmsDB(_ s: ArraySlice<Float>) -> Double {
    let sum = s.reduce(0.0) { $0 + Double($1) * Double($1) }
    return 10 * log10(max(sum / Double(max(s.count, 1)), 1e-12))
}
func spread(_ s: [Float], rate: Double = 44_100) -> (quiet: Double, loud: Double) {
    let w = Int(rate * 2); var levels: [Double] = []; var i = 0
    while i + w <= s.count { let l = rmsDB(s[i..<(i + w)]); if l > -60 { levels.append(l) }; i += w }
    levels.sort(); let third = max(1, levels.count / 3)
    return (levels.prefix(third).reduce(0, +) / Double(third), levels.suffix(third).reduce(0, +) / Double(third))
}
let before = try readLeft(inURL), after = rendered[0]
let b = spread(before), a = spread(after)
print(String(format: "before: quiet %.1f  loud %.1f  gap %.1f dB", b.quiet, b.loud, b.loud - b.quiet))
print(String(format: "after:  quiet %.1f  loud %.1f  gap %.1f dB", a.quiet, a.loud, a.loud - a.quiet))
print(String(format: "overall: %.1f -> %.1f dBFS", rmsDB(before[...]), rmsDB(after[...])))
