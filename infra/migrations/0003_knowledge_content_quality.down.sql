UPDATE knowledge_revisions kr
SET content_blocks = jsonb_build_array(kr.content_blocks -> 0, kr.content_blocks -> -1)
FROM knowledge_nodes kn
WHERE kr.knowledge_node_id = kn.id
  AND kr.version = 1
  AND kn.created_from_submission_id IS NULL
  AND kn.slug IN (
    'seven-continents', 'five-oceans', 'latitude-longitude', 'time-zones',
    'climate-and-weather', 'china-terrain-steps', 'china-administrative-levels',
    'monsoon-climate', 'population-density', 'dynasty-and-era', 'qin-unification',
    'silk-road', 'imperial-examination', 'industrial-revolution', 'gdp',
    'inflation', 'interest-rate', 'unemployment-rate', 'public-goods',
    'tax-and-fiscal-spending'
  );

UPDATE knowledge_nodes
SET summary = '现代常用划分把世界海洋分为五大洋。', updated_at = now()
WHERE slug = 'five-oceans' AND created_from_submission_id IS NULL;
