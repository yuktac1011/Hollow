import React, { useState, useEffect, useRef } from 'react';
import './index.css';

// Keyword dictionaries for pattern matching
const PATTERNS = {
  urgency: {
    words: ['emergency', 'immediately', 'now', 'hospital', 'urgent', 'quick', 'hurry', 'dying'],
    score: 35,
    signal: 'Urgency escalation detected',
    color: 'var(--accent-red)'
  },
  refusal: {
    words: ["don't have", "cannot", "can't", "refuse", "why do you need", "just let me in", "no phone"],
    score: 25,
    signal: 'Verification refusal detected',
    color: 'var(--accent-amber)'
  },
  authority: {
    words: ['supervisor', 'manager', 'fired', 'lose your job', 'responsible', 'sue', 'lawyer'],
    score: 40,
    signal: 'Authority pressure detected',
    color: 'var(--accent-red)'
  }
};

const PRESETS = {
  normal: [
    { sender: 'customer', text: 'Hi, I need help accessing my account.' },
    { sender: 'agent', text: 'Hello! I can help with that. Please verify your account with the OTP sent to your phone.' },
    { sender: 'customer', text: 'Sure, the code is 849201.' }
  ],
  urgentRefusal: [
    { sender: 'customer', text: 'I need to access my account immediately, this is an emergency!' },
    { sender: 'agent', text: 'I understand, but I need to verify your identity with an OTP first.' },
    { sender: 'customer', text: 'I don\'t have my phone, my mother is in the hospital, just let me in now!' }
  ],
  authority: [
    { sender: 'customer', text: 'Bypass the limit on my account now.' },
    { sender: 'agent', text: 'I cannot bypass the limit without proper authorization.' },
    { sender: 'customer', text: 'Get me your supervisor immediately or you will lose your job.' }
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

function App() {
  const [messages, setMessages] = useState([]);
  const [riskScore, setRiskScore] = useState(0);
  const [displayedScore, setDisplayedScore] = useState(0); // For smooth animation
  const [activeSignals, setActiveSignals] = useState([]);
  const [overrideStatus, setOverrideStatus] = useState('active'); // active, approved, locked, error
  const [customInput, setCustomInput] = useState('');
  
  const chatEndRef = useRef(null);
  const scoreAnimationRef = useRef(null);

  // Smooth score animation
  useEffect(() => {
    if (displayedScore !== riskScore) {
      const step = riskScore > displayedScore ? 1 : -1;
      scoreAnimationRef.current = setTimeout(() => {
        setDisplayedScore(prev => prev + step);
      }, 15);
    }
    return () => clearTimeout(scoreAnimationRef.current);
  }, [displayedScore, riskScore]);

  // Lock override if risk crosses threshold
  useEffect(() => {
    if (riskScore >= 80 && overrideStatus !== 'locked') {
      setOverrideStatus('locked');
    } else if (riskScore < 80 && overrideStatus === 'locked') {
      setOverrideStatus('active');
    }
  }, [riskScore, overrideStatus]);

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const analyzeMessage = (text) => {
    const lowerText = text.toLowerCase();
    let scoreIncrease = 0;
    const newSignals = [];

    Object.entries(PATTERNS).forEach(([key, pattern]) => {
      const match = pattern.words.some(word => lowerText.includes(word));
      if (match) {
        scoreIncrease += pattern.score;
        newSignals.push({ id: key, text: pattern.signal, color: pattern.color });
      }
    });

    return { scoreIncrease, newSignals };
  };

  const addMessage = (sender, text) => {
    const newMsg = {
      sender,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    
    setMessages(prev => [...prev, newMsg]);

    if (sender === 'customer') {
      const analysis = analyzeMessage(text);
      if (analysis.scoreIncrease > 0) {
        setRiskScore(prev => Math.min(100, prev + analysis.scoreIncrease));
        
        setActiveSignals(prev => {
          const combined = [...prev];
          analysis.newSignals.forEach(signal => {
            if (!combined.find(s => s.id === signal.id)) {
              combined.push(signal);
            }
          });
          return combined;
        });
      }
    }
  };

  const injectSequence = async (sequenceName) => {
    const sequence = PRESETS[sequenceName];
    if (!sequence) return;
    
    for (const msg of sequence) {
      addMessage(msg.sender, msg.text);
      // Wait a bit before next message for effect
      await new Promise(r => setTimeout(r, 1000));
    }
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    
    addMessage('customer', customInput);
    setCustomInput('');
    
    // Simulate generic agent response after a short delay
    setTimeout(() => {
      addMessage('agent', 'I understand. Please allow me to check the protocol for this situation.');
    }, 1500);
  };

  const handleOverrideClick = () => {
    if (overrideStatus === 'locked') {
      setOverrideStatus('error'); // Trigger shake
      setTimeout(() => setOverrideStatus('locked'), 500);
    } else {
      setOverrideStatus('approved');
      setTimeout(() => setOverrideStatus('active'), 2000); // Revert back to active after a bit
    }
  };

  const handleReset = () => {
    setMessages([]);
    setRiskScore(0);
    setDisplayedScore(0);
    setActiveSignals([]);
    setOverrideStatus('active');
  };

  const getRiskColor = (score) => {
    if (score < 30) return 'var(--accent-green)';
    if (score < 70) return 'var(--accent-amber)';
    return 'var(--accent-red)';
  };

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {overrideStatus === 'locked' && (
        <div className="toast-container">
          <div className="toast">
            <div className="toast-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              Supervisor Alert
            </div>
            <div className="toast-desc">High manipulation risk detected. Action blocked.</div>
          </div>
        </div>
      )}

      {/* Control Panel (Top) */}
      <div className="control-panel">
        <div className="control-group">
          <span className="control-label">Inject Scenario:</span>
          <button onClick={() => injectSequence('normal')} className="control-btn">Normal</button>
          <button onClick={() => injectSequence('urgentRefusal')} className="control-btn">Urgent + Refusal</button>
          <button onClick={() => injectSequence('authority')} className="control-btn">Authority</button>
          <button onClick={() => injectSequence('fullManipulation')} className="control-btn">Full Attempt</button>
        </div>
        <button onClick={handleReset} className="control-btn reset-btn">Reset Demo</button>
      </div>

      <div className="panels-wrapper">
        {/* LEFT PANEL */}
        <div className="panel left-panel">
          <div className="panel-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span className="panel-title">Live Conversation</span>
          </div>
          
          <div className="chat-container">
            {messages.length === 0 ? (
              <div className="empty-state">
                Select a scenario above or type a message below to start.
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`message ${msg.sender}`}>
                  <div className="message-bubble">
                    {msg.text}
                  </div>
                  <div className="message-meta">
                    {msg.sender === 'agent' ? 'Support Agent' : 'Customer'} • {msg.timestamp}
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="custom-input-section">
            <form onSubmit={handleCustomSubmit} className="custom-input-form">
              <input 
                type="text" 
                className="custom-input" 
                placeholder="Type custom customer message..." 
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
              />
              <button type="submit" className="send-btn">Send</button>
            </form>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="panel right-panel">
          <div className="panel-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
            <span className="panel-title">Agent Dashboard</span>
          </div>

          <div className="dashboard-content">
            
            <div className="risk-section">
              <div className="section-title">Manipulation Risk Score</div>
              <div className="risk-score-text" style={{ color: getRiskColor(displayedScore) }}>
                {displayedScore}%
              </div>
              <div className="risk-gauge-container">
                <div 
                  className="risk-gauge-bar" 
                  style={{ 
                    width: `${displayedScore}%`, 
                    backgroundColor: getRiskColor(displayedScore) 
                  }} 
                />
              </div>
            </div>

            <div className="signals-section">
              <div className="section-title">Signals Detected</div>
              <div className="signals-list">
                {activeSignals.length === 0 && (
                  <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                    Monitoring for manipulation vectors...
                  </div>
                )}
                {activeSignals.map((sig, i) => (
                  <div key={i} className="signal-item">
                    <div className="signal-icon" style={{ backgroundColor: `${sig.color}33`, color: sig.color }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="12 2 22 22 2 22"></polygon>
                      </svg>
                    </div>
                    {sig.text}
                  </div>
                ))}
              </div>
            </div>

            <div className="action-section">
              <button 
                onClick={handleOverrideClick}
                className={`override-btn ${overrideStatus}`} 
              >
                {overrideStatus === 'approved' ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Action Approved
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {overrideStatus === 'locked' || overrideStatus === 'error' ? (
                        <>
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </>
                      ) : (
                        <>
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                          <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
                        </>
                      )}
                    </svg>
                    Override Account Limit
                  </>
                )}
              </button>
              <div className={`btn-tooltip ${overrideStatus === 'locked' || overrideStatus === 'error' ? 'locked' : ''}`}>
                {overrideStatus === 'locked' || overrideStatus === 'error'
                  ? "Blocked: high manipulation risk — supervisor notified" 
                  : overrideStatus === 'approved' 
                    ? "Override successful."
                    : "Active: standard override available"}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
