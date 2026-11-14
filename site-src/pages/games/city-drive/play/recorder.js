// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const RECORDING_CAPTURE_FPS = 60;
const RECORDING_AUDIO_BITS_PER_SECOND = 192000;
const RECORDING_MIN_VIDEO_BITS_PER_SECOND = 12000000;
const RECORDING_MAX_VIDEO_BITS_PER_SECOND = 45000000;
const RECORDING_CHUNK_MILLISECONDS = 1000;
const RECORDING_TIMER_REFRESH_MILLISECONDS = 250;
const RECORDING_URL_REVOKE_DELAY_MILLISECONDS = 4000;

const recorder = { media: null, chunks: [], startedAt: 0, format: null, blob: null, durationMs: 0, timerId: null };
const recordingElements = {
  badge: document.getElementById("rec-badge"),
  time: document.getElementById("rec-time"),
  dialog: document.getElementById("rec-dialog"),
  info: document.getElementById("rec-info"),
  status: document.getElementById("rec-status")
};

function isRecordingDialogOpen() {
  return recordingElements.dialog.classList.contains("open");
}

function isRecording() {
  return !!recorder.media;
}

function startRecording({ sound, raiseToFullQuality }) {
  if (recorder.media || isRecordingDialogOpen()) return;
  const canvas = recordingCanvas();
  raiseToFullQuality();
  const format = pickRecordingFormat(canvas.width, canvas.height);
  if (!format || !canvas.captureStream) {
    showRecordingNotice("Recording isn't supported in this browser. Try Chrome or Edge.");
    return;
  }
  const stream = canvas.captureStream(RECORDING_CAPTURE_FPS);
  for (const track of sound.recordingAudioTracks()) stream.addTrack(track);
  const media = createMediaRecorder({ stream, format, canvas });
  recorder.chunks = [];
  recorder.format = format;
  media.start(RECORDING_CHUNK_MILLISECONDS);
  recorder.media = media;
  recorder.startedAt = performance.now();
  showRecordingBadge();
}

function stopRecording() {
  if (!recorder.media) return;
  recorder.durationMs = performance.now() - recorder.startedAt;
  clearInterval(recorder.timerId);
  recordingElements.badge.classList.remove("active");
  recorder.media.stop();
}

function closeRecordingDialog() {
  recordingElements.dialog.classList.remove("open", "notice");
  recorder.blob = null;
}

async function saveRecordingToDisk() {
  if (!recorder.blob) return;
  const fileName = recordingFileName();
  if (window.showSaveFilePicker) {
    const outcome = await saveRecordingWithFilePicker(fileName);
    if (outcome === "cancelled") {
      recordingElements.status.textContent = "Save cancelled — choose Save again or Discard.";
      return;
    }
    if (outcome === "saved") {
      closeRecordingDialog();
      return;
    }
  }
  downloadRecording(fileName);
  closeRecordingDialog();
}

function recordingCanvas() {
  return document.getElementById("gpu-canvas");
}

function pickRecordingFormat(width, height) {
  if (!window.MediaRecorder) return null;
  const avcLevel = width * height > 1920 * 1088 ? "640034" : "64002a";
  const options = [
    [`video/mp4;codecs=avc1.${avcLevel},mp4a.40.2`, "mp4"],
    [`video/mp4;codecs=avc1.${avcLevel},opus`, "mp4"],
    ["video/mp4;codecs=avc1.640028,mp4a.40.2", "mp4"],
    ["video/mp4;codecs=avc1,mp4a.40.2", "mp4"],
    ["video/mp4;codecs=avc1", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=h264,opus", "webm"],
    ["video/webm;codecs=vp9,opus", "webm"],
    ["video/webm", "webm"]
  ];
  for (const [mime, ext] of options) {
    if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  }
  return null;
}

function createMediaRecorder({ stream, format, canvas }) {
  const media = new MediaRecorder(stream, {
    mimeType: format.mime,
    videoBitsPerSecond: recordingBitrate(canvas.width, canvas.height),
    audioBitsPerSecond: RECORDING_AUDIO_BITS_PER_SECOND
  });
  media.ondataavailable = (event) => { if (event.data && event.data.size > 0) recorder.chunks.push(event.data); };
  media.onstop = () => {
    stream.getVideoTracks().forEach(track => track.stop());
    recorder.blob = new Blob(recorder.chunks, { type: format.mime.split(";")[0] });
    recorder.chunks = [];
    recorder.media = null;
    openRecordingDialog();
  };
  return media;
}

function recordingBitrate(width, height) {
  return Math.round(clamp(width * height * 60 * 0.16, RECORDING_MIN_VIDEO_BITS_PER_SECOND, RECORDING_MAX_VIDEO_BITS_PER_SECOND));
}

function showRecordingBadge() {
  recordingElements.badge.classList.add("active");
  recordingElements.time.textContent = "00:00";
  recorder.timerId = setInterval(() => {
    recordingElements.time.textContent = formatClock(performance.now() - recorder.startedAt);
  }, RECORDING_TIMER_REFRESH_MILLISECONDS);
}

function showRecordingNotice(text) {
  recordingElements.status.textContent = text;
  recordingElements.info.textContent = "";
  recordingElements.dialog.classList.add("open", "notice");
}

function openRecordingDialog() {
  const megabytes = (recorder.blob.size / (1024 * 1024)).toFixed(1);
  const canvas = recordingCanvas();
  recordingElements.info.textContent = `${formatClock(recorder.durationMs)} • ${megabytes} MB • ${recorder.format.ext.toUpperCase()} • ${canvas.width}×${canvas.height}`;
  recordingElements.status.textContent = "";
  recordingElements.dialog.classList.remove("notice");
  recordingElements.dialog.classList.add("open");
  document.getElementById("rec-save").focus();
}

function formatClock(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function recordingFileName() {
  const now = new Date();
  const twoDigits = (number) => String(number).padStart(2, "0");
  return `dev-road-${now.getFullYear()}${twoDigits(now.getMonth() + 1)}${twoDigits(now.getDate())}-${twoDigits(now.getHours())}${twoDigits(now.getMinutes())}${twoDigits(now.getSeconds())}.${recorder.format.ext}`;
}

async function saveRecordingWithFilePicker(fileName) {
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: fileName,
      types: [{ description: "Gameplay video", accept: { [recorder.blob.type]: [`.${recorder.format.ext}`] } }]
    });
    recordingElements.status.textContent = "Saving…";
    const writable = await handle.createWritable();
    await writable.write(recorder.blob);
    await writable.close();
    return "saved";
  } catch (error) {
    return error && error.name === "AbortError" ? "cancelled" : "failed";
  }
}

function downloadRecording(fileName) {
  const objectUrl = URL.createObjectURL(recorder.blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), RECORDING_URL_REVOKE_DELAY_MILLISECONDS);
}
