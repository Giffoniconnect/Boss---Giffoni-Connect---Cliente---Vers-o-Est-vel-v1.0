import React from 'react';

export default function AppLite() {
return (
<div style={{
minHeight: '100vh',
display: 'flex',
alignItems: 'center',
justifyContent: 'center',
fontFamily: 'Arial, sans-serif',
background: '#f8fafc'
}}>
<div style={{
maxWidth: 720,
padding: 32,
background: '#fff',
border: '1px solid #e5e7eb',
borderRadius: 16
}}> <h1>BOSS Giffoni Connect</h1> <p>AppLite carregado sem Firebase, sem AuthProvider, sem Router e sem motion/react.</p> <a href="/boss-giffoni-clientes/login-lite">Ir para Login Lite</a> </div> </div>
);
}
