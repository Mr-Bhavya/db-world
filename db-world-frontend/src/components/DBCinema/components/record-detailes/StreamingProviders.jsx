import { Box, Avatar, Typography, Tooltip } from '@mui/material';

const renderProviderGroup = (label, providers = []) => {
  if (!Array.isArray(providers) || !providers.length) return null;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', mt: 1 }}>
      <Typography variant="body2" sx={{ mr: 1, minWidth: 90 }}>
        {label}
      </Typography>
      {providers.map((provider) => (
        provider?.logo_path && (
          <Tooltip key={provider.provider_id || provider.provider_name} title={provider.provider_name || ''}>
            <Avatar
              src={`https://image.tmdb.org/t/p/w500${provider.logo_path}`}
              alt={provider.provider_name || ''}
              sx={{ width: 32, height: 32, mr: 1, mb: 1 }}
              variant="rounded"
            />
          </Tooltip>
        )
      ))}
    </Box>
  );
};

const StreamingProviders = ({ providers }) => {
  const safeProviders = providers || {};
  const flatrate = Array.isArray(safeProviders.flatrate) ? safeProviders.flatrate : [];
  const buy = Array.isArray(safeProviders.buy) ? safeProviders.buy : [];
  const rent = Array.isArray(safeProviders.rent) ? safeProviders.rent : [];

  if (!flatrate.length && !buy.length && !rent.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        Not available for streaming
      </Typography>
    );
  }

  return (
    <Box>
      {renderProviderGroup('Streaming on', flatrate)}
      {renderProviderGroup('Buy on', buy)}
      {renderProviderGroup('Rent on', rent)}
    </Box>
  );
};

export default StreamingProviders;