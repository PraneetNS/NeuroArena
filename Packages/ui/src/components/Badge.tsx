import React from 'react';
import {
  CleanQualityIcon,
  NoisyQualityIcon,
  DuplicateQualityIcon,
  ContaminatedQualityIcon,
  UnknownQualityIcon
} from '../icons/index.js';

export type BadgeVariant =
  | 'neutral'
  | 'accent'
  | 'accent-cool'
  | 'success'
  | 'warning'
  | 'danger'
  | 'clean'
  | 'noisy'
  | 'duplicate'
  | 'contaminated'
  | 'unknown';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function getDefaultQualityIcon(variant: string): React.ReactNode {
  switch (variant) {
    case 'clean':
      return <CleanQualityIcon size={12} />;
    case 'noisy':
      return <NoisyQualityIcon size={12} />;
    case 'duplicate':
      return <DuplicateQualityIcon size={12} />;
    case 'contaminated':
      return <ContaminatedQualityIcon size={12} />;
    case 'unknown':
      return <UnknownQualityIcon size={12} />;
    default:
      return null;
  }
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  dot = false,
  icon,
  children,
  className = '',
  ...props
}) => {
  const isQuality = ['clean', 'noisy', 'duplicate', 'contaminated', 'unknown'].includes(variant);
  const variantClass = isQuality ? `na-badge--quality-${variant}` : `na-badge--${variant}`;

  // Strict Rule: Single leading indicator only (icon OR dot, never both).
  // Data-quality badges always use the dedicated icon.
  let leadingIndicator: React.ReactNode = null;

  if (isQuality) {
    leadingIndicator = icon || getDefaultQualityIcon(variant);
  } else if (icon) {
    leadingIndicator = icon;
  } else if (dot) {
    leadingIndicator = (
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: 'currentColor',
          display: 'inline-block',
          flexShrink: 0
        }}
      />
    );
  }

  return (
    <span className={`na-badge ${variantClass} ${className}`} {...props}>
      {leadingIndicator}
      <span>{children}</span>
    </span>
  );
};
