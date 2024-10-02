'use client'
import React, { useState, useEffect, useRef } from 'react';
import '../styles/styles.css';

const IndexPage = () => {
    const [audioFile1, setAudioFile1] = useState(null);
    const [audioFile2, setAudioFile2] = useState(null);
    const [audioDuration, setAudioDuration] = useState(null);
    const [loaded, setLoaded] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [downloadLink, setDownloadLink] = useState('');
    const ffmpegRef = useRef(null);

    const handleAudioUpload1 = (e) => {
        const file = e.target.files[0];
        setAudioFile1(file);
        
        // Create an audio element to extract the duration
        const audioElement = document.createElement('audio');
        audioElement.preload = 'metadata';
        audioElement.onloadedmetadata = () => {
            setAudioDuration(audioElement.duration);
        };
        audioElement.src = URL.createObjectURL(file);
    };

    const handleAudioUpload2 = (e) => {
        const file = e.target.files[0];
        setAudioFile2(file);
    };

    useEffect(() => {
        const loadFFmpeg = async () => {
            const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
            const { FFmpeg } = await import('@ffmpeg/ffmpeg');
            const { toBlobURL } = await import('@ffmpeg/util');
            const ffmpeg = new FFmpeg();
            ffmpegRef.current = ffmpeg;
            ffmpeg.on('log', ({ message }) => {
                const timeMatch = message.match(/time=\s*(\d+:\d+:\d+\.\d+)/);
                if (timeMatch) {
                    const [hours, minutes, seconds] = timeMatch[1].split(':').map(parseFloat);
                    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
                    if (audioDuration) {
                        setProgress((totalSeconds / audioDuration) * 100);
                    }
                }
            });
            await ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
            });
            setLoaded(true);
        };

        loadFFmpeg();
    }, [audioDuration]);

    const triggerDownload = (url, filename) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const transcode = async () => {
        setProcessing(true);
        setProgress(0);
        try {
            const ffmpeg = ffmpegRef.current;
            const { fetchFile } = await import('@ffmpeg/util');
            await ffmpeg.writeFile('audio1.wav', await fetchFile(audioFile1));
            await ffmpeg.writeFile('audio2.wav', await fetchFile(audioFile2));

            await ffmpeg.exec([
                '-i', 'audio1.wav',
                '-i', 'audio2.wav',
                '-filter_complex', '[0:0][1:0]concat=n=2:v=0:a=1[out]',
                '-map', '[out]',
                'output.wav'
            ]);
            
            const data = await ffmpeg.readFile('output.wav');
            const audioURL = URL.createObjectURL(new Blob([data.buffer], { type: 'audio/wav' }));
            setDownloadLink(audioURL);

            // Automatically trigger download
            triggerDownload(audioURL, 'output.wav');
        } catch (error) {
            console.error('Error during FFmpeg command execution:', error);
        }
        setProcessing(false);
        setProgress(100);
    };

    return (
        <div className="container">
            <h1>Merge Two Audio Files</h1>
            <div className="upload-container">
                <label htmlFor="audio1">Upload Audio 1:</label>
                <input className="upload-btn" type="file" id="audio1" accept=".wav, .avi" onChange={handleAudioUpload1} />
            </div>
            <div className="upload-container">
                <label htmlFor="audio2">Upload Audio 2:</label>
                <input className="upload-btn" type="file" id="audio2" accept=".wav, .avi ,audio/*" onChange={handleAudioUpload2} />
            </div>
            {loaded && (
                <div className="actions">
                    {processing ? (
                        <div>
                            <div className="loader">Processing...</div>
                            <div className="progress-bar">
                                <div className="progress" style={{ width: `${progress}%` }}>
                                    {Math.round(progress)}%
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <button className="merge-btn" onClick={transcode}>Merge Audio Files</button>
                        </>
                    )}
                </div>
            )}
            "\n"
            {downloadLink && (
                <div className="download-link">
                    <a href={downloadLink} download="output.wav">Download Merged Audio</a>
                </div>
            )}
        </div>
    );
};

export default IndexPage;
