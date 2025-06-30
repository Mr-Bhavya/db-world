export const iconButtonStyles = {
  inactiveColor: 'rgba(255, 255, 255, 0.2)',
  activeColor: 'white',
  hoverColor: 'rgba(255, 255, 255, 0.1)',
  iconSize: '1.5rem',
};

export const spinnerIcon = (
  <i className="fas fa-spinner fa-spin" style={{ 
    fontSize: iconButtonStyles.iconSize, 
    color: iconButtonStyles.activeColor 
  }}></i>
);