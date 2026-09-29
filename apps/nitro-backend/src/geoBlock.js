module.exports = (req, res, next) => {
  // Cloudflare injects the 2-letter country code here
  const country = req.headers['cf-ipcountry'];
  
  // Add ISO country codes you want to block (e.g., 'US' for USA, 'GB' for UK)
  const restrictedCountries = ['US', 'GB', 'IR', 'KP']; 

  if (country && restrictedCountries.includes(country)) {
    return res.status(403).json({ 
      success: false, 
      error: 'Nitro-Bet is currently restricted in your region due to local licensing laws.' 
    });
  }
  
  next();
};
