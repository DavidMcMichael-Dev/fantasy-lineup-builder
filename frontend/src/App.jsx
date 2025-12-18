import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function App() {
  const [players, setPlayers] = useState([]);
  const [filteredPlayers, setFilteredPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('ALL');
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedYear, setSelectedYear] = useState(2025);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Lineup state - stores selected player IDs for each position
  const [lineup, setLineup] = useState({
    QB: null,
    RB1: null,
    RB2: null,
    WR1: null,
    WR2: null,
    TE: null,
    FLEX: null,
    K: null,
    DEF: null
  });

  // Store stats for selected players
  const [lineupStats, setLineupStats] = useState({});
  const [calculatingPoints, setCalculatingPoints] = useState(false);

  // Fetch all players on mount
  useEffect(() => {
    fetchPlayers();
  }, []);

  // Filter players when search or position changes
  useEffect(() => {
    filterPlayers();
  }, [searchTerm, selectedPosition, players]);

  const fetchPlayers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/players`);
      const data = await response.json();
      setPlayers(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching players:', error);
      setLoading(false);
    }
  };

  const filterPlayers = () => {
    let filtered = players;

    // Filter by position if not ALL
    if (selectedPosition !== 'ALL') {
      filtered = filtered.filter(p => {
        // For FLEX, show RB, WR, TE
        if (selectedPosition === 'FLEX') {
          return ['RB', 'WR', 'TE'].includes(p.position);
        }
        return p.position === selectedPosition;
      });
    }

    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.team && p.team.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredPlayers(filtered);
  };

  const addToLineup = (player, slot) => {
    setLineup(prev => ({
      ...prev,
      [slot]: player
    }));
  };

  const removeFromLineup = (slot) => {
    setLineup(prev => ({
      ...prev,
      [slot]: null
    }));
    // Remove stats for that slot
    setLineupStats(prev => {
      const newStats = { ...prev };
      delete newStats[slot];
      return newStats;
    });
  };

  const findEmptySlot = (player) => {
    const position = player.position;
    
    // Check specific position slots first
    if (position === 'QB' && !lineup.QB) return 'QB';
    if (position === 'TE' && !lineup.TE) return 'TE';
    if (position === 'K' && !lineup.K) return 'K';
    if (position === 'DEF' && !lineup.DEF) return 'DEF';
    
    if (position === 'RB') {
      if (!lineup.RB1) return 'RB1';
      if (!lineup.RB2) return 'RB2';
    }
    
    if (position === 'WR') {
      if (!lineup.WR1) return 'WR1';
      if (!lineup.WR2) return 'WR2';
    }
    
    // Check FLEX for RB, WR, TE
    if (['RB', 'WR', 'TE'].includes(position) && !lineup.FLEX) {
      return 'FLEX';
    }
    
    return null;
  };

  const calculateLineupPoints = async () => {
    setCalculatingPoints(true);
    
    // Get all player IDs from lineup
    const playerIds = Object.values(lineup)
      .filter(player => player !== null)
      .map(player => player.player_id);

    if (playerIds.length === 0) {
      alert('Add some players to your lineup first!');
      setCalculatingPoints(false);
      return;
    }

    try {
      // Check if stats exist for this week first
      const checkResponse = await fetch(`${API_URL}/api/stats/exists/${selectedYear}/${selectedWeek}`);
      const checkData = await checkResponse.json();
      
      if (!checkData.exists) {
        console.log(`Stats not found. Syncing ${selectedYear} Week ${selectedWeek}...`);
        await fetch(`${API_URL}/api/sync/stats/${selectedYear}/${selectedWeek}`, {
          method: 'POST'
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.log(`Stats already exist for ${selectedYear} Week ${selectedWeek} (${checkData.count} records)`);
      }

      const response = await fetch(`${API_URL}/api/lineup/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerIds,
          season: selectedYear,
          week: selectedWeek
        })
      });

      const data = await response.json();
      
      // Map stats back to lineup slots, adding 0 points for missing players
      const statsMap = {};
      Object.entries(lineup).forEach(([slot, player]) => {
        if (player) {
          const stat = data.stats.find(s => s.player_id === player.player_id);
          if (stat) {
            statsMap[slot] = stat;
          } else {
            statsMap[slot] = {
              player_id: player.player_id,
              points: 0,
              season: selectedYear,
              week: selectedWeek
            };
          }
        }
      });

      setLineupStats(statsMap);
    } catch (error) {
      console.error('Error calculating points:', error);
      alert('Error calculating points. Make sure stats are synced for this week.');
    } finally {
      setCalculatingPoints(false);
    }
  };

  const getTotalPoints = () => {
    return Object.values(lineupStats).reduce((sum, stat) => sum + (stat?.points || 0), 0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Mobile Header */}
      <div style={{
        display: 'none',
        padding: '15px 20px',
        backgroundColor: '#fff',
        borderBottom: '1px solid #ddd',
        alignItems: 'center',
        justifyContent: 'space-between'
      }} className="mobile-header">
        <h2 style={{ margin: 0, color: '#333' }}>Lineup Builder</h2>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {sidebarOpen ? 'Close' : 'Players'}
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, flexDirection: 'row' }}>
        {/* Left Sidebar - Player Selection */}
        <div style={{
          width: '400px',
          backgroundColor: '#fff',
          borderRight: '1px solid #ddd',
          padding: '20px',
          overflowY: 'auto'
        }} className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <h2 style={{ marginTop: 0, color: '#333' }}>Available Players</h2>
          
          {/* Position Filter */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>
              Position:
            </label>
            <select
              value={selectedPosition}
              onChange={(e) => setSelectedPosition(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '16px',
                borderRadius: '4px',
                border: '1px solid #ccc'
              }}
            >
              <option value="ALL">All Positions</option>
              <option value="QB">Quarterback (QB)</option>
              <option value="RB">Running Back (RB)</option>
              <option value="WR">Wide Receiver (WR)</option>
              <option value="TE">Tight End (TE)</option>
              <option value="FLEX">Flex (RB/WR/TE)</option>
              <option value="K">Kicker (K)</option>
              <option value="DEF">Defense/ST (DEF)</option>
            </select>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search by name or team (e.g., 'KC')..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '16px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              marginBottom: '15px'
            }}
          />

          {/* Player List */}
          {loading ? (
            <p>Loading players...</p>
          ) : (
            <div>
              <p style={{ color: '#666', fontSize: '14px', marginBottom: '10px' }}>
                {filteredPlayers.length} players
              </p>
              {filteredPlayers.slice(0, 100).map(player => (
                <div
                  key={player.player_id}
                  style={{
                    padding: '10px',
                    marginBottom: '8px',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '4px',
                    border: '1px solid #e0e0e0',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e8f4f8'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <div style={{ fontWeight: 'bold', color: '#333' }}>{player.full_name}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {player.position} - {player.team || 'FA'}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const emptySlot = findEmptySlot(player);
                        if (emptySlot) {
                          addToLineup(player, emptySlot);
                        } else {
                          alert(`No available slots for ${player.position}!`);
                        }
                      }}
                      style={{
                        padding: '5px 12px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main Content - Lineup */}
        <div style={{ flex: 1, padding: '20px', minWidth: 0 }}>
          <h1 style={{ marginTop: 0, color: '#333', display: 'block' }} className="desktop-title">Lineup Builder</h1>

          {/* Week Selector */}
          <div style={{
            backgroundColor: '#fff',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 120px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333', fontSize: '14px' }}>
                  Season:
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '16px',
                    borderRadius: '4px',
                    border: '1px solid #ccc'
                  }}
                >
                  <option value={2025}>2025</option>
                  <option value={2024}>2024</option>
                  <option value={2023}>2023</option>
                </select>
              </div>
              <div style={{ flex: '1 1 120px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333', fontSize: '14px' }}>
                  Week:
                </label>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '16px',
                    borderRadius: '4px',
                    border: '1px solid #ccc'
                  }}
                >
                  {[...Array(18)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>Week {i + 1}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: '1 1 auto', display: 'flex', alignItems: 'flex-end' }}>
                <button
                  onClick={calculateLineupPoints}
                  disabled={calculatingPoints}
                  style={{
                    width: '100%',
                    padding: '12px 24px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold'
                  }}
                >
                  {calculatingPoints ? 'Calculating...' : 'Calculate Points'}
                </button>
              </div>
            </div>
          </div>

          {/* Lineup Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
            {Object.entries(lineup).map(([slot, player]) => {
              const stats = lineupStats[slot];
              return (
                <div
                  key={slot}
                  style={{
                    backgroundColor: '#fff',
                    padding: '20px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    minHeight: '120px'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '10px'
                  }}>
                    <h3 style={{ margin: 0, color: '#007bff' }}>{slot}</h3>
                    {player && (
                      <button
                        onClick={() => removeFromLineup(slot)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {player ? (
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#333', marginBottom: '5px' }}>
                        {player.full_name}
                      </div>
                      <div style={{ color: '#666', fontSize: '14px', marginBottom: '10px' }}>
                        {player.position} - {player.team || 'FA'}
                      </div>
                      {stats && (
                        <div style={{
                          padding: '10px',
                          backgroundColor: stats.points > 0 ? '#e8f5e9' : '#f5f5f5',
                          borderRadius: '4px',
                          fontWeight: 'bold',
                          fontSize: '16px',
                          color: stats.points > 0 ? '#2e7d32' : '#666'
                        }}>
                          {stats.points.toFixed(2)} points
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: '#999', fontStyle: 'italic' }}>
                      Empty - Select a player from the left
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Total Points */}
          {Object.keys(lineupStats).length > 0 && (
            <div style={{
              marginTop: '30px',
              padding: '30px',
              backgroundColor: '#fff',
              borderRadius: '8px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
              textAlign: 'center'
            }}>
              <h2 style={{ margin: '0 0 10px 0', color: '#333' }}>Total Points</h2>
              <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#007bff' }}>
                {getTotalPoints().toFixed(2)}
              </div>
              <div style={{ color: '#666', marginTop: '10px' }}>
                {selectedYear} Week {selectedWeek}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .mobile-header {
            display: flex !important;
          }
          .desktop-title {
            display: none !important;
          }
          .sidebar {
            position: fixed;
            top: 60px;
            left: -100%;
            width: 85% !important;
            height: calc(100vh - 60px);
            z-index: 1000;
            transition: left 0.3s ease;
            box-shadow: 2px 0 5px rgba(0,0,0,0.1);
          }
          .sidebar.open {
            left: 0;
          }
        }
      `}</style>
    </div>
  );
}

export default App;