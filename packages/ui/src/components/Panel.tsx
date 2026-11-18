import React from 'react';

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'raised' | 'flat' | 'recessed';
  children: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({
  variant = 'flat',
  className = '',
  children,
  ...props
}) => {
  return (
    <div
      className={`na-panel na-panel--${variant} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export interface PanelHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({
  title,
  subtitle,
  action,
  children,
  className = '',
  ...props
}) => {
  return (
    <div className={`na-panel__header ${className}`} {...props}>
      <div>
        {title && <h3 className="na-panel__title">{title}</h3>}
        {subtitle && <div className="na-panel__subtitle">{subtitle}</div>}
      </div>
      {action && <div>{action}</div>}
      {children}
    </div>
  );
};

export const PanelBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <div className={`na-panel__body ${className}`} {...props}>
    {children}
  </div>
);

export const PanelFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <div className={`na-panel__footer ${className}`} {...props}>
    {children}
  </div>
);
