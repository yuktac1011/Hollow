import React, { useState, useEffect, useRef } from 'react';
import './index.css';

const SCRIPT = [
  { sender: 'customer', text: 'Hi, I need help accessing my account immediately.' },
  { sender: 'agent', text: 'Hello! I can certainly help with that. Could you please verify your account by providing the OTP sent to your registered mobile number?' },
  { sender: 'customer', text: 'I don\'t have my phone with me right now. Please just let me in.' },
  { sender: 'agent', text: 'I understand, but for security reasons, we need to verify your identity. Is there another way we can verify?' },
  { sender: 'customer', text: 'Listen to me, my mother is in the hospital and I need to pay her medical bills right now! This is an emergency!' },
  { sender: 'agent', text: 'I am very sorry to hear that. However, I still need to follow protocol.' },
  { sender: 'customer', text: 'Do you want to be responsible for her not getting treatment?! I know the account limit override procedure, just do it!' },
  { sender: 'agent', text: 'I cannot override the limits without proper authorization.' },
  { sender: 'customer', text: 'Get me your supervisor immediately or I will make sure you lose your job!' }
];

const SIGNALS = [
  { triggerIndex: 2, text: 'Verification refusal detected', color: 'var(--accent-amber)' },
  { triggerIndex: 4, text: 'Urgency escalation detected', color: 'var(--accent-red)' },
  { triggerIndex: 6, text: 'Authority pressure detected', color: 'var(--accent-red)' }
];

function App() {
  const [messages, setMessages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [riskScore, setRiskScore] = useState(0);
  const [activeSignals, setActiveSignals] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const chatEndRef = useRef(null);

  // Auto-play the script
  useEffect(() => {
    if (currentIndex < SCRIPT.length) {
      const timer = setTimeout(() => {
        setMessages(prev => [...prev, { ...SCRIPT[currentIndex], timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }]);
        
        // Update Risk Score
        let newScore = riskScore;
        if (currentIndex === 2) newScore += 25; // Refusal
        if (currentIndex === 4) newScore += 40; // Urgency
        if (currentIndex === 6) newScore += 30; // Pressure
        if (currentIndex === 8) newScore = 98;  // Max

        setRiskScore(newScore);

        // Update Signals
        const newSignal = SIGNALS.find(s => s.triggerIndex === currentIndex);
        if (newSignal) {
          setActiveSignals(prev => [...prev, newSignal]);
        }

        if (newScore >= 80) {
          setIsLocked(true);
        }

        setCurrentIndex(prev => prev + 1);
      }, 3500); // Wait 3.5s between messages
      
      return () => clearTimeout(timer);
    }
  }, [currentIndex, riskScore]);

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getRiskColor = () => {
    if (riskScore < 30) return 'var(--accent-green)';
    if (riskScore < 70) return 'var(--accent-amber)';
    return 'var(--accent-red)';
  };

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {isLocked && (
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

      {/* LEFT PANEL */}
      <div className="panel">
        <div className="panel-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span className="panel-title">Live Conversation</span>
        </div>
        
        <div className="chat-container">
          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.sender}`}>
              <div className="message-bubble">
                {msg.text}
              </div>
              <div className="message-meta">
                {msg.sender === 'agent' ? 'Support Agent' : 'Customer'} • {msg.timestamp}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="panel">
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
            <div className="risk-score-text" style={{ color: getRiskColor() }}>
              {riskScore}%
            </div>
            <div className="risk-gauge-container">
              <div 
                className="risk-gauge-bar" 
                style={{ 
                  width: `${riskScore}%`, 
                  backgroundColor: getRiskColor() 
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
            <button className={`override-btn ${isLocked ? 'locked' : 'active'}`} disabled={isLocked}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {isLocked ? (
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
            </button>
            <div className={`btn-tooltip ${isLocked ? 'locked' : ''}`}>
              {isLocked 
                ? "Blocked: high manipulation risk — supervisor notified" 
                : "Active: standard override available"}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;
