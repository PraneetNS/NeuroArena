import React from 'react';

export interface KeyHintProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

export const KeyHint: React.FC<KeyHintProps> = ({ children, className = '', ...props }) => {
  return (
    <kbd className={`na-keyhint ${className}`} {...props}>
      {children}
    </kbd>
  );
};
