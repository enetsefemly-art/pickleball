import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  classNameTitle?: string;
  title?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', classNameTitle = '', title }) => {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${className}`}>
      {title && (
        <div className={`px-6 py-4 border-b border-slate-100 bg-slate-50/50 ${classNameTitle}`}>
          <h3 className="font-semibold text-slate-800">{title}</h3>
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
};