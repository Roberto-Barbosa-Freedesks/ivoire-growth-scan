import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function AppLayout() {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: '#282828',
      }}
    >
      <Sidebar />

      {/* Main content area — offset by sidebar width */}
      <main
        style={{
          flex: 1,
          marginLeft: '240px',
          minHeight: '100vh',
          background: '#282828',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Subtle top accent line */}
        <div
          style={{
            height: '2px',
            background: 'linear-gradient(90deg, #FFFF02 0%, rgba(255,255,2,0.2) 60%, transparent 100%)',
            flexShrink: 0,
          }}
        />

        {/* Scrollable content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
}
