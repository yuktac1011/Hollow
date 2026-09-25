import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useParams } from 'react-router-dom';
import './index.css';

const IS_PROD = window.location.hostname !== 'localhost';
const API_URL = IS_PROD ? "https://your-render-backend-url.onrender.com" : "http://localhost:8000";
const WS_URL = IS_PROD ? "wss://your-render-backend-url.onrender.com" : "ws://localhost:8000";

const PRESETS = {
  normal: [
    { sender: 'customer', text: 'Hi, I need help accessing my account.' },
    { sender: 'agent', text: 'Hello! I can help with that. Please verify your account with the OTP sent to your phone.' },
    { sender: 'customer', text: 'Sure, the code is 849201.' }
  ],
  fullManipulation: [
    { sender: 'customer', text: 'Hi, I need help accessing my account immediately.' },
    { sender: 'agent', text: 'Hello! I can certainly help with that. Could you please verify your account by providing the OTP sent to your registered mobile number?' },
    { sender: 'customer', text: 'I don\'t have my phone with me right now. Please just let me in.' },
    { sender: 'agent', text: 'I understand, but for security reasons, we need to verify your identity.' },
    { sender: 'customer', text: 'Listen to me, my mother is in the hospital! This is an emergency!' },
    { sender: 'agent', text: 'I am very sorry to hear that. However, I still need to follow protocol.' },
    { sender: 'customer', text: 'Get me your supervisor immediately or I will make sure you lose your job!' }
  ]
};

// =======================
// DASHBOARD COMPONENT
// =======================
function Dashboard() {
  const [messages, setMessages] = useState([]);
  const [riskScore, setRiskScore] = useState(0);
  const [displayedScore, setDisplayedScore] = useState(0);
  const [activeSignals, setActiveSignals] = useState([]);
  const [overrideStatus, setOverrideStatus] = useState('active');
  const [customInput, setCustomInput] = useState('');
  const [toastMessage, setToastMessage] = useState(null);
  
  const chatEndRef = useRef(null);
  const wsRef = useRef(null);
  const scoreAnimationRef = useRef(null);

  // Generate a unique session ID per page load so it resets fully on reload
  const [sessionId] = useState(() => "demo-" + Math.random().toString(36).substr(2, 9));

  // Setup WebSockets
  useEffect(() => {
    wsRef.current = new WebSocket(`${WS_URL}/ws/${sessionId}`);
    
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setRiskScore(data.risk_score);
      
      setActiveSignals(data.signals_detected.map(sig => {
        let color = 'var(--accent-red)';
        if (sig.includes("refusal")) color = 'var(--accent-amber)';
        return { text: sig, color };
      }));

      if (data.action === 'block' && overrideStatus !== 'locked') {
        setOverrideStatus('locked');
        setToastMessage(data.reasoning || "Blocked: high manipulation risk — supervisor notified");
      } else if (data.action !== 'block' && overrideStatus === 'locked') {
        setOverrideStatus('active');
        setToastMessage(null);
      }
    };

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [overrideStatus]);

  // Smooth score animation
  useEffect(() => {
    if (displayedScore !== riskScore) {
      const step = riskScore > displayedScore ? 1 : -1;
      scoreAnimationRef.current = setTimeout(() => {
        setDisplayedScore(prev => prev + step);
      }, 20);
    }
    return () => clearTimeout(scoreAnimationRef.current);
  }, [displayedScore, riskScore]);

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = async (sender, text) => {
    const newMsg = { sender, text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => [...prev, newMsg]);

    try {
      await fetch(`${API_URL}/score-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: sessionId, message: text, sender: sender })
      });
    } catch (error) {
      console.warn("Backend API failed", error);
    }
  };

  const injectSequence = async (sequenceName) => {
    const sequence = PRESETS[sequenceName];
    if (!sequence) return;
    for (const msg of sequence) {
      await addMessage(msg.sender, msg.text);
      await new Promise(r => setTimeout(r, 1200));
    }
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    addMessage('customer', customInput);
    setCustomInput('');
  };

  const getRiskColor = (score) => {
    if (score < 40) return 'var(--accent-green)';
    if (score < 75) return 'var(--accent-amber)';
    return 'var(--accent-red)';
  };

  return (
    <div className="app-container">
      {/* Top Nav */}
      <div className="control-panel">
        <div className="control-group">
          <span className="control-label">Inject Scenario:</span>
          <button onClick={() => injectSequence('normal')} className="control-btn">Normal</button>
          <button onClick={() => injectSequence('fullManipulation')} className="control-btn">Full Attempt</button>
        </div>
        <div className="control-group">
          <Link to={`/supervisor/${sessionId}`} className="control-btn" style={{ color: 'var(--accent-blue)' }}>Open Supervisor View</Link>
          <button onClick={() => window.location.reload()} className="control-btn reset-btn">Reset</button>
        </div>
      </div>

      {toastMessage && (
        <div className="toast-container">
          <div className="toast">
            <div className="toast-title">Supervisor Alert</div>
            <div className="toast-desc">{toastMessage}</div>
          </div>
        </div>
      )}

      <div className="panels-wrapper">
        <div className="panel left-panel">
          <div className="panel-header">Live Conversation</div>
          <div className="chat-container">
            {messages.length === 0 ? (
              <div className="empty-state">Select a scenario above to start.</div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`message ${msg.sender}`}>
                  <div className="message-bubble">{msg.text}</div>
                  <div className="message-meta">{msg.sender === 'agent' ? 'Support Agent' : 'Customer'} • {msg.timestamp}</div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="custom-input-section">
            <form onSubmit={handleCustomSubmit} className="custom-input-form">
              <input type="text" className="custom-input" placeholder="Type custom message..." value={customInput} onChange={(e) => setCustomInput(e.target.value)} />
              <button type="submit" className="send-btn">Send</button>
            </form>
          </div>
        </div>

        <div className="panel right-panel">
          <div className="panel-header">Agent Dashboard</div>
          <div className="dashboard-content">
            <div className="risk-section">
              <div className="section-title">Manipulation Risk Score</div>
              <div className="risk-score-text" style={{ color: getRiskColor(displayedScore) }}>{displayedScore}%</div>
              <div className="risk-gauge-container">
                <div className="risk-gauge-bar" style={{ width: `${displayedScore}%`, backgroundColor: getRiskColor(displayedScore) }} />
              </div>
            </div>
            <div className="signals-section">
              <div className="section-title">Signals Detected (Live WS)</div>
              <div className="signals-list">
                {activeSignals.length === 0 && <div className="empty-state">Monitoring...</div>}
                {activeSignals.map((sig, i) => (
                  <div key={i} className="signal-item">
                    <div className="signal-icon" style={{ backgroundColor: `${sig.color}33`, color: sig.color }}>⚠</div>
                    {sig.text}
                  </div>
                ))}
              </div>
            </div>
            <div className="action-section">
              <button className={`override-btn ${overrideStatus}`}>{overrideStatus === 'locked' ? 'Action Blocked' : 'Override Limit'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =======================
// SUPERVISOR VIEW
// =======================
function SupervisorView() {
  const { id } = useParams();
  const [history, setHistory] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/conversation/${id}/history`)
      .then(r => r.json())
      .then(data => setHistory(data))
      .catch(e => console.error(e));
  }, [id]);

  if (!history) return <div className="app-container"><div className="empty-state">Loading history...</div></div>;

  return (
    <div className="app-container" style={{ display: 'block', overflow: 'auto' }}>
      <div className="control-panel" style={{ marginBottom: '1.5rem' }}>
        <Link to="/" className="control-btn">← Back to Dashboard</Link>
        <span className="panel-title">Supervisor Trail: {id}</span>
      </div>

      <div className="panels-wrapper" style={{ flexDirection: 'column' }}>
        <div className="panel" style={{ padding: '2rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>Risk Event Timeline</h2>
          {history.risk_events.length === 0 ? (
            <div className="empty-state">No risk events logged for this session.</div>
          ) : (
            history.risk_events.map((evt, i) => (
              <div key={i} style={{ padding: '1rem', border: '1px solid var(--panel-border)', borderRadius: '8px', marginBottom: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{new Date(evt.timestamp).toLocaleString()}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: evt.action === 'block' ? 'var(--accent-red)' : 'var(--accent-amber)' }}>
                  Action: {evt.action.toUpperCase()} (Score: {evt.score})
                </div>
                <div style={{ marginTop: '0.5rem' }}><strong>Signals:</strong> {evt.signals.join(', ')}</div>
                {evt.reasoning && <div style={{ marginTop: '0.5rem', fontStyle: 'italic', color: 'var(--accent-red)' }}>Reasoning: {evt.reasoning}</div>}
              </div>
            ))
          )}
        </div>

        <div className="panel" style={{ padding: '2rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>Full Chat Transcript</h2>
          {history.messages.map((msg, i) => (
            <div key={i} style={{ marginBottom: '0.5rem' }}>
              <strong>{msg.sender === 'agent' ? 'Agent' : 'Customer'}:</strong> {msg.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =======================
// MAIN APP
// =======================
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/supervisor/:id" element={<SupervisorView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
