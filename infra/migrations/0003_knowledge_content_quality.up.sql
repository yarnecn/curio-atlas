-- Upgrade the original starter knowledge cards so every card has a direct answer
-- and a short explanation instead of a single abstract summary.
UPDATE knowledge_nodes kn
SET summary = CASE
  WHEN kn.slug = 'five-oceans' THEN '海水在全球相连，五大洋是按大陆、海峡和南极周边海域等地理约定划出的五个区域；南冰洋通常指环绕南极洲、北至南纬60°的海域。'
  ELSE kn.summary
END,
updated_at = now()
WHERE kn.created_from_submission_id IS NULL
  AND kn.slug IN (
    'seven-continents', 'five-oceans', 'latitude-longitude', 'time-zones',
    'climate-and-weather', 'china-terrain-steps', 'china-administrative-levels',
    'monsoon-climate', 'population-density', 'dynasty-and-era', 'qin-unification',
    'silk-road', 'imperial-examination', 'industrial-revolution', 'gdp',
    'inflation', 'interest-rate', 'unemployment-rate', 'public-goods',
    'tax-and-fiscal-spending'
  );

UPDATE knowledge_revisions kr
SET content_blocks = jsonb_build_array(
  jsonb_build_object('type', 'paragraph', 'text', kr.content_blocks -> 0 ->> 'text'),
  jsonb_build_object('type', 'heading', 'level', 2, 'text', '为什么值得知道'),
  jsonb_build_object('type', 'paragraph', 'text', kn.summary),
  kr.content_blocks -> 1
)
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

-- Older idempotent seed runs could leave the node pointer empty when the
-- revision already existed. Point every starter node at its published v1.
UPDATE knowledge_nodes kn
SET current_revision_id = kr.id,
    updated_at = now()
FROM knowledge_revisions kr
WHERE kr.knowledge_node_id = kn.id
  AND kr.version = 1
  AND kn.current_revision_id IS NULL
  AND kn.created_from_submission_id IS NULL
  AND kn.slug IN (
    'seven-continents', 'five-oceans', 'latitude-longitude', 'time-zones',
    'climate-and-weather', 'china-terrain-steps', 'china-administrative-levels',
    'monsoon-climate', 'population-density', 'dynasty-and-era', 'qin-unification',
    'silk-road', 'imperial-examination', 'industrial-revolution', 'gdp',
    'inflation', 'interest-rate', 'unemployment-rate', 'public-goods',
    'tax-and-fiscal-spending'
  );
