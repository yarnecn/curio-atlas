-- Keep approved V1 batch content aligned with the canonical catalog even when
-- approval happened before the broad-taxonomy seed was introduced.
UPDATE knowledge_nodes AS kn
SET topic_id = t.id
FROM topics AS t
WHERE t.slug = CASE
  WHEN kn.slug IN ('latitude-longitude', 'time-zones', 'map-projection') THEN 'earth-and-maps'
  WHEN kn.slug IN ('seven-continents', 'five-oceans', 'population-density') THEN 'world-regions'
  WHEN kn.slug IN ('china-location', 'china-terrain-types', 'china-terrain-steps', 'china-administrative-levels', 'monsoon-climate') THEN 'china-geography'
  WHEN kn.slug IN ('climate-and-weather', 'plate-tectonics', 'south-north-water-resources') THEN 'climate-and-earth-systems'
  WHEN kn.slug IN ('dynasty-and-era', 'historical-evidence') THEN 'historical-method'
  WHEN kn.slug IN ('qin-unification', 'silk-road', 'imperial-examination', 'population-southward', 'sui-unification') THEN 'ancient-china'
  WHEN kn.slug = 'industrial-revolution' THEN 'world-civilizations'
  WHEN kn.slug IN ('gdp', 'inflation', 'nominal-and-real', 'monetary-policy', 'fiscal-policy') THEN 'macroeconomy'
  WHEN kn.slug = 'interest-rate' THEN 'personal-finance'
  WHEN kn.slug = 'unemployment-rate' THEN 'business-trade-and-work'
  WHEN kn.slug = 'policy-goal-tool-result' THEN 'government-and-policy'
  WHEN kn.slug IN ('public-goods', 'tax-and-fiscal-spending') THEN 'public-services-and-security'
  WHEN kn.slug IN ('externalities', 'information-asymmetry') THEN 'social-cooperation'
  ELSE NULL
END;
