import React from 'react';
import './Logo.css';

export default function Logo({ small = false }) {
  return (
    <div className={`logo ${small ? 'logo--small' : ''}`}>
      <span className="logo__kris">КРИС</span>
      <span className="logo__quiz">-КВИЗ</span>
    </div>
  );
}
