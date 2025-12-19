import React from 'react';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import LineupBuilder from './LineupBuilder';
import DraftGame from './DraftGame';

function App() {
  return (
    <HashRouter>
      <nav style={{ 
        padding: '15px 20px', 
        backgroundColor: '#007bff',
        display: 'flex',
        gap: '20px',
        alignItems: 'baseline'
      }}>
        <Link to="/" style={{ 
          color: 'white', 
          textDecoration: 'none',
          fontWeight: 'bold',
          fontSize: '16px'
        }}>
          Lineup Builder
        </Link>
        <Link to="/draft" style={{ 
          color: 'white', 
          textDecoration: 'none',
          fontWeight: 'bold',
          fontSize: '16px'
        }}>
          Draft Battle
        </Link>
        {localStorage.getItem('draftGameSession') && (
  <button
    onClick={() => {
      localStorage.removeItem('draftGameSession');
      window.location.reload();
    }}
    style={{
      color: 'white', 
          textDecoration: 'none',
          fontWeight: 'bold',
          fontSize: '16px',
          background: 'transparent',
    }}
  >
    Clear Saved Session
  </button>
)}
        </nav>
      <Routes>
        <Route path="/" element={<LineupBuilder />} />
        <Route path="/draft" element={<DraftGame />} />
      </Routes>
    </HashRouter>
  );
}

export default App;