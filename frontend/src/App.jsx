import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import LineupBuilder from './LineupBuilder';
import DraftGame from './DraftGame';

function App() {
  return (
    <BrowserRouter>
      <nav style={{ 
        padding: '15px 20px', 
        backgroundColor: '#007bff',
        display: 'flex',
        gap: '20px'
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
      </nav>
      <Routes>
        <Route path="/" element={<LineupBuilder />} />
        <Route path="/draft" element={<DraftGame />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;