import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function DraftGame() {
  const [screen, setScreen] = useState('menu');
  const [gameCode, setGameCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [session, setSession] = useState(null);
  const [socket, setSocket] = useState(null);
  const [allPlayers, setAllPlayers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('ALL');

  useEffect(() => {
    fetchAllPlayers();
  }, []);

  useEffect(() => {
    if (gameCode && playerId) {
      const newSocket = io(API_URL);
      setSocket(newSocket);

      newSocket.emit('join-game', { gameCode, playerId });

      newSocket.on('game-update', (updatedSession) => {
        setSession(updatedSession);
        if (updatedSession.status === 'active') {
          setScreen('game');
        }
      });

      newSocket.on('error', (error) => {
        alert(error.message);
      });

      return () => newSocket.close();
    }
  }, [gameCode, playerId]);

  const fetchAllPlayers = async () => {
    const response = await fetch(`${API_URL}/api/players`);
    const data = await response.json();
    setAllPlayers(data);
  };

  const createGame = async () => {
    if (!playerName) {
      alert('Enter your name!');
      return;
    }

    const response = await fetch(`${API_URL}/api/game/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName })
    });

    const data = await response.json();
    setGameCode(data.gameCode);
    setPlayerId(data.playerId);
    setScreen('lobby');

    const checkResponse = await fetch(`${API_URL}/api/stats/exists/${data.season}/${data.week}`);
    const checkData = await checkResponse.json();
      
    if (!checkData.exists) {
    console.log(`Stats not found. Syncing ${data.season} Week ${data.week}...`);
    await fetch(`${API_URL}/api/sync/stats/${data.season}/${data.week}`, {
        method: 'POST'
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
    console.log(`Stats already exist for ${data.season} Week ${data.week} (${checkData.count} records)`);
    }
  };

  const joinGame = async () => {
    if (!playerName || !gameCode) {
      alert('Enter your name and game code!');
      return;
    }

    const response = await fetch(`${API_URL}/api/game/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameCode, playerName })
    });

    const data = await response.json();
    if (data.error) {
      alert(data.error);
      return;
    }

    setPlayerId(data.playerId);
    setScreen('lobby');
  };

  const markReady = () => {
    socket?.emit('player-ready', { gameCode, playerId });
  };

const getMyLineup = () => {
  if (!session) return [];
  const me = session.players.find(p => p.id === playerId);
  return me?.lineup.map(l => l.playerId) || [];
};

  const getPositionCount = (position) => {
    const myLineup = getMyLineup();
    return allPlayers.filter(p => 
      myLineup.includes(p.player_id) && p.position === position
    ).length;
  };

  const canPickPosition = (position) => {
  const myLineup = getMyLineup();
  
  // Count each position in the lineup
  let qbCount = 0, rbCount = 0, wrCount = 0, teCount = 0, kCount = 0, defCount = 0;
  
  myLineup.forEach(playerId => {
    const player = allPlayers.find(p => p.player_id === playerId);
    if (player) {
      if (player.position === 'QB') qbCount++;
      else if (player.position === 'RB') rbCount++;
      else if (player.position === 'WR') wrCount++;
      else if (player.position === 'TE') teCount++;
      else if (player.position === 'K') kCount++;
      else if (player.position === 'DEF') defCount++;
    }
  });
  
  // Check limits
  const limits = { QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DEF: 1 };
  const counts = { QB: qbCount, RB: rbCount, WR: wrCount, TE: teCount, K: kCount, DEF: defCount };
  

  if (position === 'FLEX') {
    if (wrCount === 3 || rbCount === 3 || teCount === 2) return false; // FLEX full
    return myLineup.length < 9; // Can pick FLEX if lineup not full
  }
  
  return counts[position] < limits[position];
};

const pickPlayer = (player) => {
  const myLineup = getMyLineup();
  
  // Check if lineup is full
  if (myLineup.length >= 9) {
    alert('Your lineup is full!');
    return;
  }
  
  // For QB, K, DEF - simple check
  if (['QB', 'K', 'DEF'].includes(player.position)) {
    if (!canPickPosition(player.position)) {
      alert(`${player.position} slot is already filled!`);
      return;
    }
  }
  
  // For RB and WR - can go to FLEX if main slots full
  if (['RB', 'WR', 'TE'].includes(player.position)) {
    const positionAvailable = canPickPosition(player.position);
    const flexAvailable = canPickPosition('FLEX');
    
    if (!positionAvailable && !flexAvailable) {
      alert(`No slots available for ${player.position}!`);
      return;
    }
  }
  
  socket?.emit('pick-player', {
    gameCode,
    playerId,
    pickedPlayerId: player.player_id
  });
};

  const isMyTurn = () => {
    if (!session) return false;
    const currentPlayer = session.players[session.currentTurn];
    return currentPlayer?.id === playerId;
  };

  const getAvailablePlayers = () => {
    if (!session) return allPlayers;
    return allPlayers.filter(p => !session.pickedPlayers.includes(p.player_id));
  };

  const filteredPlayers = getAvailablePlayers().filter(p => {
    const matchesSearch = p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (p.team && p.team.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesPosition = selectedPosition === 'ALL' || p.position === selectedPosition;
    return matchesSearch && matchesPosition;
  });

  // Menu Screen
  if (screen === 'menu') {
    return (
      <div style={{ 
        padding: '40px', 
        maxWidth: '500px', 
        margin: '50px auto',
        backgroundColor: '#fff',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ textAlign: 'center', color: '#007bff', marginBottom: '30px' }}>
          🏈 Draft Battle
        </h1>
        <input
          placeholder="Your Name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          style={{ 
            width: '100%', 
            padding: '12px', 
            marginBottom: '15px',
            border: '2px solid #ddd',
            borderRadius: '8px',
            fontSize: '16px'
          }}
        />
        <button 
          onClick={createGame} 
          style={{ 
            width: '100%', 
            padding: '15px', 
            marginBottom: '20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Create New Game
        </button>
        
        <div style={{ 
          textAlign: 'center', 
          margin: '20px 0',
          color: '#999',
          fontWeight: 'bold'
        }}>
          OR
        </div>
        
        <input
          placeholder="Game Code (e.g., ABC123)"
          value={gameCode}
          onChange={(e) => setGameCode(e.target.value.toUpperCase())}
          style={{ 
            width: '100%', 
            padding: '12px', 
            marginBottom: '15px',
            border: '2px solid #ddd',
            borderRadius: '8px',
            fontSize: '16px',
            textAlign: 'center',
            textTransform: 'uppercase'
          }}
        />
        <button 
          onClick={joinGame} 
          style={{ 
            width: '100%', 
            padding: '15px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Join Game
        </button>
      </div>
    );
  }

  // Lobby Screen
  if (screen === 'lobby' && session?.status === 'waiting') {
    return (
      <div style={{ 
        padding: '40px', 
        maxWidth: '600px', 
        margin: '50px auto',
        textAlign: 'center'
      }}>
        <h1 style={{ color: '#007bff', fontSize: '48px', marginBottom: '10px' }}>
          {gameCode}
        </h1>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '30px' }}>
          Share this code with your opponent
        </p>
        
        <div style={{ 
          padding: '20px', 
          backgroundColor: '#e8f4f8', 
          borderRadius: '12px',
          marginBottom: '30px'
        }}>
          <h2 style={{ margin: '10px 0', color: '#333' }}>
            📅 {session.season} Week {session.week}
          </h2>
          <p style={{ color: '#666', margin: 0, fontSize: '14px' }}>
            Draft 9 players: 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX, 1 K, 1 DEF
          </p>
        </div>
        
        <h3 style={{ marginBottom: '20px' }}>Waiting Room</h3>
        <div style={{ marginBottom: '30px' }}>
          {session.players.map((p, i) => (
            <div key={i} style={{ 
              padding: '20px',
              backgroundColor: '#fff',
              borderRadius: '12px',
              marginBottom: '15px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              border: '2px solid ' + (p.ready ? '#28a745' : '#ddd'),
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <span style={{ fontWeight: 'bold', fontSize: '20px' }}>{p.name}</span>
              {p.ready ? (
                <span style={{ color: '#28a745', fontSize: '28px' }}>✓</span>
              ) : (
                <span style={{ color: '#999', fontSize: '14px' }}>Waiting...</span>
              )}
            </div>
          ))}
          
          {session.players.length < 2 && (
            <div style={{ 
              padding: '30px',
              backgroundColor: '#f9f9f9',
              borderRadius: '12px',
              border: '2px dashed #ddd'
            }}>
              <p style={{ color: '#999', margin: 0 }}>
                Waiting for opponent to join...
              </p>
            </div>
          )}
        </div>
        
        {session.players.length === 2 && (
          <button 
            onClick={markReady} 
            style={{ 
              padding: '15px 60px',
              fontSize: '20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(40,167,69,0.3)'
            }}
          >
            Ready to Draft! 🎯
          </button>
        )}
      </div>
    );
  }

  // Game Screen
  if (screen === 'game' && (session?.status === 'active' || session?.status === 'finished')) {
    const myPlayer = session.players.find(p => p.id === playerId);
    const opponent = session.players.find(p => p.id !== playerId);
    
    return (
      <div style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ 
          padding: '15px 30px', 
          backgroundColor: '#007bff', 
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div>
            <h2 style={{ margin: 0 }}>📅 {session.season} Week {session.week}</h2>
          </div>
          <div style={{ 
            fontSize: '24px', 
            fontWeight: 'bold',
            padding: '8px 20px',
            backgroundColor: isMyTurn() ? '#28a745' : 'rgba(255,255,255,0.2)',
            borderRadius: '8px'
          }}>
            { session?.status === 'finished' ? '🏁 Draft Finished' : isMyTurn() ? '🎯 YOUR TURN!' : '⏳ Waiting...'}
          </div>
          <div style={{ fontSize: '18px' }}>
            Your Picks: {myPlayer?.lineup.length || 0}/9
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Player Selection Sidebar */}
          <div style={{ 
            width: '400px', 
            padding: '20px', 
            overflowY: 'auto', 
            borderRight: '1px solid #ddd',
            backgroundColor: '#f9f9f9'
          }}>
            <h3 style={{ marginTop: 0 }}>Available Players</h3>
            
            <select
              value={selectedPosition}
              onChange={(e) => setSelectedPosition(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                marginBottom: '10px',
                borderRadius: '8px',
                border: '2px solid #ddd',
                fontSize: '14px'
              }}
            >
              <option value="ALL">All Positions</option>
              <option value="QB">QB ({getPositionCount('QB')}/1)</option>
              <option value="RB">RB ({getPositionCount('RB')}/2)</option>
              <option value="WR">WR ({getPositionCount('WR')}/2)</option>
              <option value="TE">TE ({getPositionCount('TE')}/1)</option>
              <option value="K">K ({getPositionCount('K')}/1)</option>
              <option value="DEF">DEF ({getPositionCount('DEF')}/1)</option>
            </select>
            
            <input
              placeholder="Search players or teams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '10px', 
                marginBottom: '15px', 
                borderRadius: '8px',
                border: '2px solid #ddd'
              }}
            />
            
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
              {filteredPlayers.length} players available
            </div>
            
            {filteredPlayers.slice(0, 100).map(player => (
              <div
                key={player.player_id}
                style={{
                  padding: '12px',
                  marginBottom: '8px',
                  backgroundColor: '#fff',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: '2px solid #e0e0e0',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    {player.full_name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {player.position} - {player.team}
                  </div>
                </div>
                <button
                  onClick={() => pickPlayer(player)}
                  disabled={!isMyTurn() || session.status === 'finished'}
                  style={{ 
                    padding: '6px 16px',
                    backgroundColor: !isMyTurn() || session.status === 'finished' ? '#ccc' : '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: !isMyTurn() || session.status === 'finished' ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    fontSize: '12px'
                  }}
                >
                  Pick
                </button>
              </div>
            ))}
          </div>

          {/* Lineups Display */}
          <div style={{ flex: 1, padding: '30px', overflowY: 'auto', backgroundColor: '#fff' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
              {session.players.map((player, idx) => (
                <div key={idx} style={{ 
                  padding: '25px',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '12px',
                  border: '3px solid ' + (player.id === playerId ? '#007bff' : '#ddd'),
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '15px',
                    paddingBottom: '15px',
                    borderBottom: '2px solid #ddd'
                  }}>
                    <h3 style={{ 
                      margin: 0,
                      color: player.id === playerId ? '#007bff' : '#333',
                      fontSize: '22px'
                    }}>
                      {player.name} {player.id === playerId && '(You)'}
                    </h3>
                    <div style={{ 
                      fontSize: '16px', 
                      color: '#666',
                      fontWeight: 'bold'
                    }}>
                      {player.lineup.length}/9
                    </div>
                  </div>
                  
                  <div>
                    {player.lineup.length === 0 ? (
                      <div style={{ 
                        padding: '40px 20px',
                        textAlign: 'center',
                        color: '#999',
                        fontStyle: 'italic'
                      }}>
                        No picks yet
                      </div>
                    ) : (
                        player.lineup.map((slot, i) => {
                        const p = allPlayers.find(pl => pl.player_id === slot.playerId);
                        return (
                          <div key={i} style={{ 
                            padding: '12px',
                            backgroundColor: '#fff',
                            marginBottom: '8px',
                            borderRadius: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            border: '2px solid #e0e0e0'
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                                {p?.full_name || 'Loading...'}
                              </div>
                              <div style={{ fontSize: '11px', color: '#666' }}>
                                {p?.position} - {p?.team}
                              </div>
                            </div>
                            {session.status === 'finished' && (
                                <div style={{
                                fontWeight: 'bold',
                                fontSize: '14px',
                                color: '#28a745'
                                }}>
                                {slot.points.toFixed(2)} pts
                                </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                  
                  {session.status === 'finished' && player.score !== undefined && (
                    <div style={{
                      marginTop: '20px',
                      padding: '20px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      borderRadius: '12px',
                      textAlign: 'center',
                      fontWeight: 'bold',
                      fontSize: '28px',
                      boxShadow: '0 4px 12px rgba(40,167,69,0.3)'
                    }}>
                      {player.score.toFixed(2)} pts
                    </div>
                  )}
                </div>
              ))}
            </div>

            {session.status === 'finished' && (
              <div style={{ 
                marginTop: '40px', 
                textAlign: 'center',
                padding: '40px',
                backgroundColor: '#f9f9f9',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}>
                <h1 style={{ fontSize: '56px', margin: '20px 0', color: '#007bff' }}>
                  {session.players[0].score > session.players[1].score
                    ? `🏆 ${session.players[0].name} Wins!`
                    : session.players[1].score > session.players[0].score
                    ? `🏆 ${session.players[1].name} Wins!`
                    : "🤝 It's a Tie!"}
                </h1>
                <div style={{ fontSize: '24px', color: '#666', marginBottom: '30px' }}>
                  {session.players[0].name}: {session.players[0].score.toFixed(2)} pts  |  
                  {session.players[1].name}: {session.players[1].score.toFixed(2)} pts
                </div>
                <button 
                  onClick={() => window.location.reload()}
                  style={{
                    padding: '18px 50px',
                    fontSize: '20px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 12px rgba(0,123,255,0.3)'
                  }}
                >
                  Play Again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
}

export default DraftGame;