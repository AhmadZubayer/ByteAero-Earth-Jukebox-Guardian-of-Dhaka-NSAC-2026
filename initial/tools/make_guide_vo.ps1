# Earth Jukebox - TEMPORARY guide voiceover (Windows text-to-speech), for timing review only.
# Not a performance and not for release: replace with recorded voices (see Memory.md).
# Input: JSON array of { id, voice ("Echo"|"Presenter"), rate (-10..10), text }.
param([Parameter(Mandatory = $true)][string]$Json, [Parameter(Mandatory = $true)][string]$OutDir)
Add-Type -AssemblyName System.Speech
$lines = Get-Content -Raw -Encoding UTF8 $Json | ConvertFrom-Json
New-Item -ItemType Directory -Force $OutDir | Out-Null
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(48000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
foreach ($l in $lines) {
    $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
    if ($l.voice -eq "Echo") { $s.SelectVoice("Microsoft Zira Desktop") } else { $s.SelectVoice("Microsoft David Desktop") }
    $s.Rate = [int]$l.rate
    $s.SetOutputToWaveFile((Join-Path $OutDir ($l.id + ".wav")), $fmt)
    $s.Speak([string]$l.text)
    $s.SetOutputToNull()
    $s.Dispose()
}
