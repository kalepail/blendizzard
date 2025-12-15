import { useNavigate } from 'react-router-dom'
import { useWalletStore } from '@/stores/walletStore'
import { disconnect as disconnectWallet } from '@/lib/smartAccount'
import { AsciiBackground } from './AsciiBackground'

export function AccountPage() {
  const navigate = useNavigate()
  const { address, disconnect } = useWalletStore()

  const handleDisconnect = async () => {
    await disconnectWallet()
    disconnect()
    navigate('/')
  }

  const truncateAddress = (addr: string) => {
    if (addr.length <= 16) return addr
    return `${addr.slice(0, 8)}...${addr.slice(-8)}`
  }

  return (
    <div className="min-h-screen relative" style={{ zIndex: 1 }}>
      <AsciiBackground />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-terminal-dim bg-terminal-bg/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-mono text-sm tracking-wider">
            <span className="text-terminal-dim">[</span>
            <span className="text-terminal-fg">BLENDIZZARD</span>
            <span className="text-terminal-dim">]</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-terminal-dim text-xs">
              {address && truncateAddress(address)}
            </span>
            <button
              onClick={handleDisconnect}
              className="text-terminal-dim hover:text-terminal-fg text-xs border border-terminal-dim px-3 py-1 transition-colors"
            >
              DISCONNECT
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="min-h-screen flex items-center justify-center px-4 pt-16">
        <div className="max-w-2xl w-full">
          {/* Welcome Banner */}
          <div className="ascii-box p-8 bg-terminal-bg/90 mb-8">
            <div className="text-center mb-8">
              <p className="text-terminal-dim text-xs tracking-[0.3em] mb-2">{'// DASHBOARD //'}</p>
              <h1 className="text-2xl md:text-3xl font-bold tracking-wider text-terminal-fg">
                WELCOME, PLAYER
              </h1>
            </div>

            <div className="border border-terminal-dim p-4 mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-terminal-dim text-xs">SMART WALLET:</span>
                <span className="text-terminal-fg text-xs font-mono">ACTIVE</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-terminal-dim text-xs">CONTRACT ID:</span>
                <span className="text-terminal-fg text-[10px] font-mono break-all">
                  {address || 'N/A'}
                </span>
              </div>
            </div>

            <pre className="text-terminal-dim text-xs text-center mb-8">
{`
┌────────────────────────────────────────────┐
│                                            │
│     THIS IS A PLACEHOLDER DASHBOARD        │
│                                            │
│     FULL FUNCTIONALITY COMING SOON:        │
│     - FACTION SELECTION                    │
│     - VAULT DEPOSITS                       │
│     - GAME CATALOG                         │
│     - REWARDS CLAIMING                     │
│                                            │
└────────────────────────────────────────────┘
`}
            </pre>

            {/* Placeholder Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="border border-terminal-dim p-4 text-center">
                <div className="text-terminal-fg text-2xl font-bold">---</div>
                <div className="text-terminal-dim text-[10px] tracking-wider">DEPOSITED</div>
              </div>
              <div className="border border-terminal-dim p-4 text-center">
                <div className="text-terminal-fg text-2xl font-bold">---</div>
                <div className="text-terminal-dim text-[10px] tracking-wider">FACTION PTS</div>
              </div>
              <div className="border border-terminal-dim p-4 text-center">
                <div className="text-terminal-fg text-2xl font-bold">---</div>
                <div className="text-terminal-dim text-[10px] tracking-wider">GAMES WON</div>
              </div>
              <div className="border border-terminal-dim p-4 text-center">
                <div className="text-terminal-fg text-2xl font-bold">---</div>
                <div className="text-terminal-dim text-[10px] tracking-wider">REWARDS</div>
              </div>
            </div>
          </div>

          {/* Faction Selection Placeholder */}
          <div className="ascii-box p-6 bg-terminal-bg/90 mb-8">
            <h2 className="text-terminal-fg text-lg tracking-wider mb-4 text-center">
              SELECT YOUR FACTION
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {['~', '/', '#'].map((symbol, i) => (
                <button
                  key={symbol}
                  className="border border-terminal-dim p-4 text-center hover:bg-terminal-fg/5 transition-colors opacity-50 cursor-not-allowed"
                  disabled
                >
                  <div className="text-4xl font-mono text-terminal-fg/60 mb-2">{symbol}</div>
                  <div className="text-terminal-dim text-[10px]">
                    {['NOODLE', 'STICK', 'ROCK'][i]}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-terminal-dim text-xs text-center mt-4">
              FACTION SELECTION DISABLED // COMING SOON
            </p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <button
              className="btn-retro text-sm opacity-50 cursor-not-allowed"
              disabled
            >
              DEPOSIT
            </button>
            <button
              className="btn-retro text-sm opacity-50 cursor-not-allowed"
              disabled
            >
              PLAY GAME
            </button>
          </div>

          <div className="text-center mt-8">
            <p className="text-terminal-dim text-xs">
              {'// '} SYSTEM STATUS: DEVELOPMENT {'//'}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
