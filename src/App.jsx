import React, {
  useEffect,
  useRef,
  useState,
} from "react";

export default function App() {
  return (
    <div className="bg-black text-cyan-300 min-h-screen overflow-y-auto font-mono">
      <style>{`
        body {
          margin: 0;
          background: #02040a;
          overflow-x: hidden;
        }

        .glass {
          background: rgba(255,255,255,0.03);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(0,255,255,0.15);
          box-shadow: 0 0 20px rgba(0,255,255,0.08);
        }

        .grid-bg {
          background-image:
            linear-gradient(rgba(0,255,255,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,255,0.05) 1px, transparent 1px);
          background-size: 40px 40px;
        }

        input[type="range"] {
          width: 100%;
          accent-color: cyan;
        }

        canvas {
          touch-action: none;
        }
      `}</style>

      <MainSystem />
    </div>
  );
}

function MainSystem() {
  const visualizerRef = useRef(null);
  const oscilloscopeRef = useRef(null);
  const spectrumRef = useRef(null);

  const analyserRef = useRef(null);
  const audioCtxRef = useRef(null);
  const dataArrayRef = useRef(null);
  const timeArrayRef = useRef(null);
  const streamRef = useRef(null);

  const [micEnabled, setMicEnabled] =
    useState(false);

  const [freqX, setFreqX] = useState(2);
  const [freqY, setFreqY] = useState(3);
  const [phase, setPhase] = useState(1.5);
  const [gain, setGain] = useState(1.4);
  const [trail, setTrail] = useState(0.04);

  useEffect(() => {
    const canvas = visualizerRef.current;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    resize();

    window.addEventListener("resize", resize);

    let t = 0;

    const render = () => {
      requestAnimationFrame(render);

      ctx.fillStyle = `rgba(0,0,0,${trail})`;

      ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      const audio = getAudioData();

      ctx.save();

      ctx.translate(
        canvas.width / 2,
        canvas.height / 2
      );

      ctx.beginPath();

      for (let i = 0; i < 2200; i++) {
        const p = i / 100;

        const x =
          Math.sin(
            (freqX + audio.mid * 2.5) *
              p +
              phase +
              t
          ) *
          (120 + audio.bass * 140) *
          gain;

        const y =
          Math.sin(
            (freqY + audio.treble * 2.5) *
              p +
              t
          ) *
          (120 + audio.bass * 140) *
          gain;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.strokeStyle = "#00ffff";
      ctx.lineWidth = 2.5;

      ctx.shadowBlur = 50;
      ctx.shadowColor = "#00ffff";

      ctx.stroke();

      ctx.restore();

      t += 0.008 + audio.bass * 0.05;

      drawOscilloscope();
      drawSpectrum();
    };

    render();

    return () =>
      window.removeEventListener(
        "resize",
        resize
      );
  }, [freqX, freqY, phase, gain, trail]);

  const getAudioData = () => {
    if (
      !analyserRef.current ||
      !dataArrayRef.current
    ) {
      return {
        bass: 0,
        mid: 0,
        treble: 0,
      };
    }

    analyserRef.current.getByteFrequencyData(
      dataArrayRef.current
    );

    let bass = 0;
    let mid = 0;
    let treble = 0;

    for (
      let i = 0;
      i < dataArrayRef.current.length;
      i++
    ) {
      const v =
        dataArrayRef.current[i] / 255;

      if (i < 20) bass += v;
      else if (i < 80) mid += v;
      else treble += v;
    }

    bass /= 20;
    mid /= 60;
    treble /= 100;

    return {
      bass,
      mid,
      treble,
    };
  };

  const toggleMic = async () => {
    if (micEnabled) {
      streamRef.current?.getTracks().forEach(
        (track) => track.stop()
      );

      audioCtxRef.current?.close();

      setMicEnabled(false);

      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            audio: true,
          }
        );

      streamRef.current = stream;

      const audioCtx =
        new (window.AudioContext ||
          window.webkitAudioContext)();

      const analyser =
        audioCtx.createAnalyser();

      analyser.fftSize = 2048;

      const source =
        audioCtx.createMediaStreamSource(
          stream
        );

      source.connect(analyser);

      analyserRef.current = analyser;

      dataArrayRef.current =
        new Uint8Array(
          analyser.frequencyBinCount
        );

      timeArrayRef.current =
        new Uint8Array(
          analyser.frequencyBinCount
        );

      audioCtxRef.current = audioCtx;

      setMicEnabled(true);
    } catch {
      alert("Microphone denied.");
    }
  };

  const drawOscilloscope = () => {
    const canvas =
      oscilloscopeRef.current;

    if (
      !canvas ||
      !analyserRef.current ||
      !timeArrayRef.current
    )
      return;

    const ctx = canvas.getContext("2d");

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    analyserRef.current.getByteTimeDomainData(
      timeArrayRef.current
    );

    ctx.fillStyle = "#050816";

    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.beginPath();

    for (
      let i = 0;
      i < timeArrayRef.current.length;
      i++
    ) {
      const x =
        (i /
          timeArrayRef.current.length) *
        canvas.width;

      const y =
        (timeArrayRef.current[i] / 255) *
        canvas.height;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.strokeStyle = "#00ff99";
    ctx.lineWidth = 2.5;

    ctx.shadowBlur = 15;
    ctx.shadowColor = "#00ff99";

    ctx.stroke();
  };

  const drawSpectrum = () => {
    const canvas = spectrumRef.current;

    if (
      !canvas ||
      !analyserRef.current ||
      !dataArrayRef.current
    )
      return;

    const ctx = canvas.getContext("2d");

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    analyserRef.current.getByteFrequencyData(
      dataArrayRef.current
    );

    ctx.fillStyle = "#050816";

    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    const barWidth =
      canvas.width /
      dataArrayRef.current.length;

    for (
      let i = 0;
      i < dataArrayRef.current.length;
      i++
    ) {
      const h =
        (dataArrayRef.current[i] / 255) *
        canvas.height;

      ctx.fillStyle = "#00ffff";

      ctx.shadowBlur = 8;
      ctx.shadowColor = "#00ffff";

      ctx.fillRect(
        i * barWidth,
        canvas.height - h,
        Math.max(barWidth - 1, 1),
        h
      );
    }
  };

  return (
    <div className="grid-bg p-2 md:p-4 min-h-screen">

      {/* HEADER */}

      <div className="glass rounded-3xl px-4 md:px-8 py-5 md:py-6 flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">

        <div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-widest leading-tight">
            AUDIO CONTROLLED
            <br />
            HARMONIC VISUALIZER
          </h1>

          <p className="text-cyan-500 mt-2 text-sm md:text-base">
            INTERACTIVE SIGNAL PHYSICS LAB
          </p>
        </div>

        <button
          onClick={toggleMic}
          className="w-full md:w-auto px-6 md:px-8 py-4 rounded-2xl border border-cyan-400 bg-cyan-500/10 text-lg md:text-xl"
        >
          {micEnabled
            ? "DISABLE MICROPHONE"
            : "ENABLE MICROPHONE"}
        </button>
      </div>

      {/* MAIN */}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">

        {/* CIRCUIT */}

        <div className="xl:col-span-4 glass rounded-3xl p-4 md:p-5">

          <div className="text-2xl md:text-3xl mb-4">
            Interactive Schematic
          </div>

          <CircuitEditor />
        </div>

        {/* VISUALIZER */}

        <div className="xl:col-span-8 flex flex-col gap-4">

          <div className="glass rounded-3xl relative overflow-hidden h-[280px] md:h-[700px]">

            <canvas
              ref={visualizerRef}
              className="absolute inset-0 w-full h-full"
            />

            <div className="absolute top-4 left-4 md:top-5 md:left-5 bg-black/40 px-4 py-3 rounded-2xl border border-cyan-500/20">

              <div className="text-xl md:text-3xl font-bold">
                LIVE LISSAJOUS ENGINE
              </div>

              <div className="text-cyan-500 text-xs md:text-base">
                AUDIO REACTIVE HARMONIC SYSTEM
              </div>
            </div>
          </div>

          {/* BOTTOM */}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

            <div className="glass rounded-3xl p-4 h-[180px] md:h-[300px]">

              <div className="text-xl md:text-2xl mb-3">
                Oscilloscope
              </div>

              <canvas
                ref={oscilloscopeRef}
                className="w-full h-full"
              />
            </div>

            <div className="glass rounded-3xl p-4 h-[180px] md:h-[300px]">

              <div className="text-xl md:text-2xl mb-3">
                Spectrum Analyzer
              </div>

              <canvas
                ref={spectrumRef}
                className="w-full h-full"
              />
            </div>
          </div>

          {/* CONTROLS */}

          <div className="glass rounded-3xl p-4 md:p-5">

            <div className="text-2xl md:text-3xl mb-5">
              Harmonic Controls
            </div>

            <Slider
              label="Frequency X"
              min={1}
              max={10}
              step={0.1}
              value={freqX}
              setValue={setFreqX}
            />

            <Slider
              label="Frequency Y"
              min={1}
              max={10}
              step={0.1}
              value={freqY}
              setValue={setFreqY}
            />

            <Slider
              label="Phase Shift"
              min={0}
              max={6.28}
              step={0.01}
              value={phase}
              setValue={setPhase}
            />

            <Slider
              label="Gain"
              min={0.2}
              max={3}
              step={0.1}
              value={gain}
              setValue={setGain}
            />

            <Slider
              label="Trail"
              min={0.01}
              max={0.2}
              step={0.01}
              value={trail}
              setValue={setTrail}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function CircuitEditor() {
  return (
    <div className="h-[260px] md:h-[650px] bg-[#050816] rounded-2xl border border-cyan-500/20 relative overflow-auto">

      <svg
        viewBox="0 0 900 650"
        className="w-[900px] h-[650px]"
      >

        <defs>
          <pattern
            id="grid"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="rgba(0,255,255,0.05)"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        <rect
          width="100%"
          height="100%"
          fill="url(#grid)"
        />

        {/* AUDIO INPUT */}

        <circle
          cx="60"
          cy="120"
          r="7"
          fill="#ffff00"
        />

        <text
          x="20"
          y="90"
          fill="#ffffff"
          fontSize="18"
        >
          Audio Input
        </text>

        {/* INPUT WIRE */}

        <line
          x1="60"
          y1="120"
          x2="120"
          y2="120"
          stroke="#00ff99"
          strokeWidth="3"
        />

        {/* CAPACITOR */}

        <line
          x1="130"
          y1="90"
          x2="130"
          y2="150"
          stroke="#ffffff"
          strokeWidth="4"
        />

        <line
          x1="150"
          y1="90"
          x2="150"
          y2="150"
          stroke="#ffffff"
          strokeWidth="4"
        />

        <text
          x="110"
          y="70"
          fill="#ffffff"
          fontSize="16"
        >
          C1
        </text>

        <text
          x="90"
          y="175"
          fill="#ffffff"
          fontSize="16"
        >
          2.2µF
        </text>

        {/* CONNECTION */}

        <line
          x1="150"
          y1="120"
          x2="240"
          y2="120"
          stroke="#ffffff"
          strokeWidth="3"
        />

        {/* RESISTOR */}

        <polyline
          points="
          240,120
          255,105
          270,135
          285,105
          300,135
          315,105
          330,120
          "
          fill="none"
          stroke="#ffffff"
          strokeWidth="3"
        />

        <text
          x="250"
          y="90"
          fill="#ffffff"
          fontSize="16"
        >
          R1 10kΩ
        </text>

        {/* WIRE */}

        <line
          x1="330"
          y1="120"
          x2="420"
          y2="120"
          stroke="#ffffff"
          strokeWidth="3"
        />

        {/* OPAMP */}

        <polygon
          points="420,60 420,180 540,120"
          fill="none"
          stroke="#ffffff"
          strokeWidth="3"
        />

        <text
          x="450"
          y="125"
          fill="#ffffff"
          fontSize="24"
        >
          LM358
        </text>

        {/* FEEDBACK */}

        <line
          x1="540"
          y1="120"
          x2="620"
          y2="120"
          stroke="#ffffff"
          strokeWidth="3"
        />

        <polyline
          points="
          620,120
          635,105
          650,135
          665,105
          680,135
          695,105
          710,120
          "
          fill="none"
          stroke="#ffffff"
          strokeWidth="3"
        />

        <line
          x1="710"
          y1="120"
          x2="710"
          y2="250"
          stroke="#ffffff"
          strokeWidth="3"
        />

        <line
          x1="710"
          y1="250"
          x2="420"
          y2="250"
          stroke="#ffffff"
          strokeWidth="3"
        />

        <line
          x1="420"
          y1="250"
          x2="420"
          y2="145"
          stroke="#ffffff"
          strokeWidth="3"
        />

        <text
          x="630"
          y="90"
          fill="#ffffff"
          fontSize="16"
        >
          R2 100kΩ
        </text>

        {/* OUTPUT */}

        <line
          x1="540"
          y1="120"
          x2="820"
          y2="120"
          stroke="#00ff99"
          strokeWidth="4"
        />

        <circle
          cx="820"
          cy="120"
          r="7"
          fill="#ffff00"
        />

        <text
          x="840"
          y="126"
          fill="#ffffff"
          fontSize="22"
        >
          X OUT
        </text>

        {/* SECOND STAGE */}

        <polygon
          points="420,340 420,460 540,400"
          fill="none"
          stroke="#ffffff"
          strokeWidth="3"
        />

        <text
          x="450"
          y="405"
          fill="#ffffff"
          fontSize="24"
        >
          LM358
        </text>

        {/* FEED */}

        <line
          x1="240"
          y1="120"
          x2="240"
          y2="400"
          stroke="#ffffff"
          strokeWidth="3"
        />

        <line
          x1="240"
          y1="400"
          x2="420"
          y2="400"
          stroke="#ffffff"
          strokeWidth="3"
        />

        {/* RC FILTER */}

        <line
          x1="540"
          y1="400"
          x2="620"
          y2="400"
          stroke="#ffffff"
          strokeWidth="3"
        />

        <polyline
          points="
          620,400
          635,385
          650,415
          665,385
          680,415
          695,385
          710,400
          "
          fill="none"
          stroke="#ffffff"
          strokeWidth="3"
        />

        <text
          x="620"
          y="365"
          fill="#ffffff"
          fontSize="16"
        >
          RC FILTER
        </text>

        {/* Y OUTPUT */}

        <line
          x1="710"
          y1="400"
          x2="820"
          y2="400"
          stroke="#ff00ff"
          strokeWidth="4"
        />

        <circle
          cx="820"
          cy="400"
          r="7"
          fill="#ffff00"
        />

        <text
          x="840"
          y="405"
          fill="#ffffff"
          fontSize="22"
        >
          Y OUT
        </text>

        {/* GROUND */}

        <line
          x1="80"
          y1="560"
          x2="760"
          y2="560"
          stroke="#ffffff"
          strokeWidth="2"
        />

        <text
          x="780"
          y="565"
          fill="#ffffff"
          fontSize="20"
        >
          GND
        </text>

      </svg>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  setValue,
}) {
  return (
    <div className="mb-8">

      <div className="flex justify-between mb-3 text-base md:text-lg">
        <span>{label}</span>

        <span>{value}</span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) =>
          setValue(
            parseFloat(e.target.value)
          )
        }
      />
    </div>
  );
}