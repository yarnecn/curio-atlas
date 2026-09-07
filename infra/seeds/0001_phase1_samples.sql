INSERT INTO app_users (id, public_handle, display_name, role, verification_status)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'site-owner', '站长', 'owner', 'verified'),
  ('00000000-0000-4000-8000-000000000002', 'pine-42', '松针42', 'user', 'verified'),
  ('00000000-0000-4000-8000-000000000003', 'atlas-17', '海图17', 'user', 'verified')
ON CONFLICT (id) DO NOTHING;

INSERT INTO app_users (id, public_handle, display_name, role, verification_status)
SELECT
  ('70000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid,
  'sample-voter-' || lpad(number::text, 2, '0'),
  '样例用户' || lpad(number::text, 2, '0'),
  'user',
  'verified'
FROM generate_series(1, 20) AS number
ON CONFLICT (id) DO NOTHING;

INSERT INTO knowledge_domains (id, slug, name, description, sort_order)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'geography', '地理', '理解空间、区域与人地关系。', 10),
  ('10000000-0000-4000-8000-000000000002', 'history', '历史', '理解时间线、制度与因果关系。', 20),
  ('10000000-0000-4000-8000-000000000003', 'economy-society', '经济与社会', '理解经济指标和社会运行机制。', 30)
ON CONFLICT (id) DO NOTHING;

INSERT INTO interests (id, slug, name, description)
VALUES
  ('11000000-0000-4000-8000-000000000001', 'understand-the-world', '理解世界', '从地理和历史建立世界框架。'),
  ('11000000-0000-4000-8000-000000000002', 'understand-the-economy', '理解经济', '理解与生活有关的经济常识。')
ON CONFLICT (id) DO NOTHING;

INSERT INTO topics (id, domain_id, slug, name, description)
VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'world-geography', '世界地理骨架', '大洲、大洋、气候与区域。'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'china-geography', '中国地理骨架', '区划、地形、气候与人口。'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'china-history', '中国历史主时间线', '朝代、制度和关键转折。'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003', 'economy-basics', '经济运行常识', 'GDP、通胀、利率与就业。'),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000003', 'social-systems', '社会制度常识', '公共服务、财政和社会协作。')
ON CONFLICT (id) DO NOTHING;

UPDATE topics
SET v1_target_count = CASE slug
  WHEN 'world-geography' THEN 35
  WHEN 'china-geography' THEN 35
  WHEN 'china-history' THEN 60
  WHEN 'economy-basics' THEN 20
  WHEN 'social-systems' THEN 15
  ELSE v1_target_count
END
WHERE slug IN ('world-geography', 'china-geography', 'china-history', 'economy-basics', 'social-systems');

INSERT INTO interest_topics (interest_id, topic_id)
VALUES
  ('11000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001'),
  ('11000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002'),
  ('11000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003'),
  ('11000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000004'),
  ('11000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000005')
ON CONFLICT DO NOTHING;

INSERT INTO sources (id, publisher, title, url, source_type, license)
VALUES
  ('80000000-0000-4000-8000-000000000001', '中华人民共和国中央人民政府', '中国政府网公开资料', 'https://www.gov.cn/', 'official', 'link_and_fact_reference_only'),
  ('80000000-0000-4000-8000-000000000002', '国家统计局', '国家统计局公开数据', 'https://www.stats.gov.cn/', 'official', 'link_and_fact_reference_only'),
  ('80000000-0000-4000-8000-000000000003', '联合国', '联合国公开资料', 'https://www.un.org/zh/', 'official', 'link_and_fact_reference_only')
ON CONFLICT (id) DO NOTHING;

WITH samples(id, revision_id, topic_id, slug, title, summary, statement, source_id) AS (
  VALUES
    ('30000000-0000-4000-8000-000000000001'::uuid, '40000000-0000-4000-8000-000000000001'::uuid, '20000000-0000-4000-8000-000000000001'::uuid, 'seven-continents', '七大洲', '常用地理划分把全球陆地分为七大洲。', '七大洲是亚洲、非洲、北美洲、南美洲、南极洲、欧洲和大洋洲。', '80000000-0000-4000-8000-000000000003'::uuid),
    ('30000000-0000-4000-8000-000000000002'::uuid, '40000000-0000-4000-8000-000000000002'::uuid, '20000000-0000-4000-8000-000000000001'::uuid, 'five-oceans', '五大洋', '海水在全球相连，五大洋是按大陆、海峡和南极周边海域等地理约定划出的五个区域；南冰洋通常指环绕南极洲、北至南纬60°的海域。', '五大洋是太平洋、大西洋、印度洋、南冰洋和北冰洋。', '80000000-0000-4000-8000-000000000003'::uuid),
    ('30000000-0000-4000-8000-000000000003'::uuid, '40000000-0000-4000-8000-000000000003'::uuid, '20000000-0000-4000-8000-000000000001'::uuid, 'latitude-longitude', '经纬度', '经纬度是描述地球表面位置的坐标系统。', '纬度表示南北位置，经度表示东西位置，两者共同定位地球表面的地点。', '80000000-0000-4000-8000-000000000003'::uuid),
    ('30000000-0000-4000-8000-000000000004'::uuid, '40000000-0000-4000-8000-000000000004'::uuid, '20000000-0000-4000-8000-000000000001'::uuid, 'time-zones', '时区', '时区让不同经度地区使用与太阳位置大致匹配的时间。', '全球以本初子午线为基准划分时区，实际边界会结合行政区调整。', '80000000-0000-4000-8000-000000000003'::uuid),
    ('30000000-0000-4000-8000-000000000005'::uuid, '40000000-0000-4000-8000-000000000005'::uuid, '20000000-0000-4000-8000-000000000001'::uuid, 'climate-and-weather', '气候与天气', '天气描述短期大气状态，气候描述较长时期的统计特征。', '一天的降雨属于天气，某地区多年平均降雨特征属于气候。', '80000000-0000-4000-8000-000000000003'::uuid),
    ('30000000-0000-4000-8000-000000000006'::uuid, '40000000-0000-4000-8000-000000000006'::uuid, '20000000-0000-4000-8000-000000000002'::uuid, 'china-terrain-steps', '中国地势三级阶梯', '中国地势总体西高东低，常概括为三级阶梯。', '中国地势由青藏高原向东逐级降低，对河流流向和气候产生重要影响。', '80000000-0000-4000-8000-000000000001'::uuid),
    ('30000000-0000-4000-8000-000000000007'::uuid, '40000000-0000-4000-8000-000000000007'::uuid, '20000000-0000-4000-8000-000000000002'::uuid, 'china-administrative-levels', '中国行政区划层级', '行政区划用于分层组织国家行政管理。', '中国行政区划通常按省级、地级、县级和乡级等层级理解。', '80000000-0000-4000-8000-000000000001'::uuid),
    ('30000000-0000-4000-8000-000000000008'::uuid, '40000000-0000-4000-8000-000000000008'::uuid, '20000000-0000-4000-8000-000000000002'::uuid, 'monsoon-climate', '季风气候', '季风是随季节显著改变方向的大尺度风系。', '中国东部季风区的降水季节变化与海陆热力差异密切相关。', '80000000-0000-4000-8000-000000000001'::uuid),
    ('30000000-0000-4000-8000-000000000009'::uuid, '40000000-0000-4000-8000-000000000009'::uuid, '20000000-0000-4000-8000-000000000002'::uuid, 'population-density', '人口密度', '人口密度表示单位面积上的人口数量。', '人口密度适合比较空间分布，但不能单独说明生活质量或资源压力。', '80000000-0000-4000-8000-000000000002'::uuid),
    ('30000000-0000-4000-8000-000000000010'::uuid, '40000000-0000-4000-8000-000000000010'::uuid, '20000000-0000-4000-8000-000000000003'::uuid, 'dynasty-and-era', '朝代与时代', '朝代是政权序列，时代是分析历史时使用的时间范围。', '朝代更替是理解中国历史时间线的骨架，但不能代替对社会连续性的观察。', '80000000-0000-4000-8000-000000000001'::uuid),
    ('30000000-0000-4000-8000-000000000011'::uuid, '40000000-0000-4000-8000-000000000011'::uuid, '20000000-0000-4000-8000-000000000003'::uuid, 'qin-unification', '秦统一', '秦统一建立了中国历史上重要的中央集权国家形态。', '公元前221年秦完成统一，并推行一系列统一制度。', '80000000-0000-4000-8000-000000000001'::uuid),
    ('30000000-0000-4000-8000-000000000012'::uuid, '40000000-0000-4000-8000-000000000012'::uuid, '20000000-0000-4000-8000-000000000003'::uuid, 'silk-road', '丝绸之路', '丝绸之路是跨区域交流网络的统称。', '丝绸之路不是单一固定道路，而是连接欧亚多地的贸易与文化交流网络。', '80000000-0000-4000-8000-000000000003'::uuid),
    ('30000000-0000-4000-8000-000000000013'::uuid, '40000000-0000-4000-8000-000000000013'::uuid, '20000000-0000-4000-8000-000000000003'::uuid, 'imperial-examination', '科举制度', '科举以考试选拔官员，对中国古代社会流动和治理产生长期影响。', '科举制度在不同朝代形式有所变化，不能视为始终相同的一套考试。', '80000000-0000-4000-8000-000000000001'::uuid),
    ('30000000-0000-4000-8000-000000000014'::uuid, '40000000-0000-4000-8000-000000000014'::uuid, '20000000-0000-4000-8000-000000000003'::uuid, 'industrial-revolution', '工业革命', '工业革命使生产方式、能源使用和社会结构发生深刻变化。', '工业革命是长期过程，不是发生在单一日期的一次事件。', '80000000-0000-4000-8000-000000000003'::uuid),
    ('30000000-0000-4000-8000-000000000015'::uuid, '40000000-0000-4000-8000-000000000015'::uuid, '20000000-0000-4000-8000-000000000004'::uuid, 'gdp', '国内生产总值', 'GDP 衡量一定时期内一个经济体生产的最终产品和服务价值。', 'GDP 可以描述经济总量和变化，但不能独立代表收入分配或生活质量。', '80000000-0000-4000-8000-000000000002'::uuid),
    ('30000000-0000-4000-8000-000000000016'::uuid, '40000000-0000-4000-8000-000000000016'::uuid, '20000000-0000-4000-8000-000000000004'::uuid, 'inflation', '通货膨胀', '通货膨胀通常指总体价格水平在一段时间内持续上涨。', '个别商品涨价不必然等于总体通货膨胀，需要观察一篮子商品和服务。', '80000000-0000-4000-8000-000000000002'::uuid),
    ('30000000-0000-4000-8000-000000000017'::uuid, '40000000-0000-4000-8000-000000000017'::uuid, '20000000-0000-4000-8000-000000000004'::uuid, 'interest-rate', '利率', '利率是借用资金的价格之一。', '利率变化会影响借贷、储蓄、投资和资产定价，但影响存在时间差。', '80000000-0000-4000-8000-000000000002'::uuid),
    ('30000000-0000-4000-8000-000000000018'::uuid, '40000000-0000-4000-8000-000000000018'::uuid, '20000000-0000-4000-8000-000000000004'::uuid, 'unemployment-rate', '失业率', '失业率衡量劳动力人口中没有工作但在寻找工作的比例。', '失业率的分母是劳动力人口，不是全部人口。', '80000000-0000-4000-8000-000000000002'::uuid),
    ('30000000-0000-4000-8000-000000000019'::uuid, '40000000-0000-4000-8000-000000000019'::uuid, '20000000-0000-4000-8000-000000000005'::uuid, 'public-goods', '公共物品', '公共物品通常具有非排他性和非竞争性。', '国防是常见例子，但现实中的公共服务不一定完全满足两个特征。', '80000000-0000-4000-8000-000000000001'::uuid),
    ('30000000-0000-4000-8000-000000000020'::uuid, '40000000-0000-4000-8000-000000000020'::uuid, '20000000-0000-4000-8000-000000000005'::uuid, 'tax-and-fiscal-spending', '税收与财政支出', '税收为公共支出提供重要资金来源。', '财政收支影响公共服务和经济运行，具体作用取决于结构、时点和执行方式。', '80000000-0000-4000-8000-000000000001'::uuid)
), inserted_nodes AS (
  INSERT INTO knowledge_nodes (id, topic_id, slug, title, summary, status, next_review_at)
  SELECT id, topic_id, slug, title, summary, 'published', now() + interval '12 months'
  FROM samples
  ON CONFLICT (id) DO NOTHING
  RETURNING id
), available_nodes AS (
  SELECT id FROM inserted_nodes
  UNION
  SELECT kn.id
  FROM knowledge_nodes kn
  JOIN samples ON samples.id = kn.id
), inserted_revisions AS (
  INSERT INTO knowledge_revisions (
    id, knowledge_node_id, version, content_blocks, change_summary, author_id,
    reviewer_id, review_status, ai_involvement, published_at
  )
  SELECT
    samples.revision_id,
    samples.id,
    1,
    jsonb_build_array(
      jsonb_build_object('type', 'paragraph', 'text', samples.statement),
      jsonb_build_object('type', 'heading', 'level', 2, 'text', '为什么值得知道'),
      jsonb_build_object('type', 'paragraph', 'text', samples.summary),
      jsonb_build_object('type', 'source', 'sourceId', samples.source_id::text)
    ),
    'Phase 1 样例内容',
    '00000000-0000-4000-8000-000000000001'::uuid,
    '00000000-0000-4000-8000-000000000001'::uuid,
    'published',
    'none',
    now()
  FROM samples
  JOIN available_nodes ON available_nodes.id = samples.id
  ON CONFLICT (id) DO NOTHING
  RETURNING id
)
UPDATE knowledge_nodes kn
SET current_revision_id = samples.revision_id
FROM samples
WHERE kn.id = samples.id
  AND kn.current_revision_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM knowledge_revisions kr
    WHERE kr.id = samples.revision_id
  );

WITH samples(node_id, revision_id, statement, source_id) AS (
  VALUES
    ('30000000-0000-4000-8000-000000000001'::uuid, '40000000-0000-4000-8000-000000000001'::uuid, '七大洲是亚洲、非洲、北美洲、南美洲、南极洲、欧洲和大洋洲。', '80000000-0000-4000-8000-000000000003'::uuid),
    ('30000000-0000-4000-8000-000000000002'::uuid, '40000000-0000-4000-8000-000000000002'::uuid, '五大洋是太平洋、大西洋、印度洋、南冰洋和北冰洋。', '80000000-0000-4000-8000-000000000003'::uuid),
    ('30000000-0000-4000-8000-000000000003'::uuid, '40000000-0000-4000-8000-000000000003'::uuid, '经纬度共同描述地球表面的位置。', '80000000-0000-4000-8000-000000000003'::uuid),
    ('30000000-0000-4000-8000-000000000004'::uuid, '40000000-0000-4000-8000-000000000004'::uuid, '时区以本初子午线为基准并结合行政边界调整。', '80000000-0000-4000-8000-000000000003'::uuid),
    ('30000000-0000-4000-8000-000000000005'::uuid, '40000000-0000-4000-8000-000000000005'::uuid, '天气描述短期状态，气候描述长期统计特征。', '80000000-0000-4000-8000-000000000003'::uuid),
    ('30000000-0000-4000-8000-000000000006'::uuid, '40000000-0000-4000-8000-000000000006'::uuid, '中国地势总体西高东低。', '80000000-0000-4000-8000-000000000001'::uuid),
    ('30000000-0000-4000-8000-000000000007'::uuid, '40000000-0000-4000-8000-000000000007'::uuid, '中国行政区划可按多个层级理解。', '80000000-0000-4000-8000-000000000001'::uuid),
    ('30000000-0000-4000-8000-000000000008'::uuid, '40000000-0000-4000-8000-000000000008'::uuid, '季风是随季节显著改变方向的大尺度风系。', '80000000-0000-4000-8000-000000000001'::uuid),
    ('30000000-0000-4000-8000-000000000009'::uuid, '40000000-0000-4000-8000-000000000009'::uuid, '人口密度表示单位面积上的人口数量。', '80000000-0000-4000-8000-000000000002'::uuid),
    ('30000000-0000-4000-8000-000000000010'::uuid, '40000000-0000-4000-8000-000000000010'::uuid, '朝代与时代是不同的历史时间概念。', '80000000-0000-4000-8000-000000000001'::uuid),
    ('30000000-0000-4000-8000-000000000011'::uuid, '40000000-0000-4000-8000-000000000011'::uuid, '公元前221年秦完成统一。', '80000000-0000-4000-8000-000000000001'::uuid),
    ('30000000-0000-4000-8000-000000000012'::uuid, '40000000-0000-4000-8000-000000000012'::uuid, '丝绸之路是跨区域交流网络的统称。', '80000000-0000-4000-8000-000000000003'::uuid),
    ('30000000-0000-4000-8000-000000000013'::uuid, '40000000-0000-4000-8000-000000000013'::uuid, '科举制度在不同朝代存在变化。', '80000000-0000-4000-8000-000000000001'::uuid),
    ('30000000-0000-4000-8000-000000000014'::uuid, '40000000-0000-4000-8000-000000000014'::uuid, '工业革命是长期历史过程。', '80000000-0000-4000-8000-000000000003'::uuid),
    ('30000000-0000-4000-8000-000000000015'::uuid, '40000000-0000-4000-8000-000000000015'::uuid, 'GDP 衡量一定时期内生产的最终产品和服务价值。', '80000000-0000-4000-8000-000000000002'::uuid),
    ('30000000-0000-4000-8000-000000000016'::uuid, '40000000-0000-4000-8000-000000000016'::uuid, '通货膨胀通常指总体价格水平持续上涨。', '80000000-0000-4000-8000-000000000002'::uuid),
    ('30000000-0000-4000-8000-000000000017'::uuid, '40000000-0000-4000-8000-000000000017'::uuid, '利率是借用资金的价格之一。', '80000000-0000-4000-8000-000000000002'::uuid),
    ('30000000-0000-4000-8000-000000000018'::uuid, '40000000-0000-4000-8000-000000000018'::uuid, '失业率的分母是劳动力人口。', '80000000-0000-4000-8000-000000000002'::uuid),
    ('30000000-0000-4000-8000-000000000019'::uuid, '40000000-0000-4000-8000-000000000019'::uuid, '公共物品通常具有非排他性和非竞争性。', '80000000-0000-4000-8000-000000000001'::uuid),
    ('30000000-0000-4000-8000-000000000020'::uuid, '40000000-0000-4000-8000-000000000020'::uuid, '税收为公共支出提供重要资金来源。', '80000000-0000-4000-8000-000000000001'::uuid)
)
INSERT INTO claims (knowledge_revision_id, statement, source_id, verified_by, verified_at)
SELECT revision_id, statement, source_id, '00000000-0000-4000-8000-000000000001'::uuid, now()
FROM samples
WHERE NOT EXISTS (SELECT 1 FROM claims c WHERE c.knowledge_revision_id = samples.revision_id);

WITH samples(id, revision_id, topic_id, statement, why_useful, applicability, source_url, status) AS (
  VALUES
    ('50000000-0000-4000-8000-000000000001'::uuid, '60000000-0000-4000-8000-000000000001'::uuid, '20000000-0000-4000-8000-000000000001'::uuid, '看世界地图时先认大洲和大洋，再记国家位置，会更容易建立空间框架。', '先有空间骨架能减少孤立记忆。', '适用于刚开始补世界地理常识的人。', 'https://www.un.org/zh/', 'trial'),
    ('50000000-0000-4000-8000-000000000002'::uuid, '60000000-0000-4000-8000-000000000002'::uuid, '20000000-0000-4000-8000-000000000002'::uuid, '行政区划和自然地理不是一回事，理解地区时要分别查看。', '可以避免把行政边界误当作自然边界。', '适用于阅读区域、人口和经济资料。', 'https://www.gov.cn/', 'trial'),
    ('50000000-0000-4000-8000-000000000003'::uuid, '60000000-0000-4000-8000-000000000003'::uuid, '20000000-0000-4000-8000-000000000003'::uuid, '理解历史事件时，先分清事件发生时间和后人解释它的时间。', '能减少把后来的概念直接套到过去。', '适用于历史阅读和史料辨析。', 'https://www.gov.cn/', 'trial'),
    ('50000000-0000-4000-8000-000000000004'::uuid, '60000000-0000-4000-8000-000000000004'::uuid, '20000000-0000-4000-8000-000000000004'::uuid, '看到单月价格上涨，不应立刻把它等同于持续通货膨胀。', '有助于更准确地理解价格新闻。', '需要结合价格指数、范围和持续时间。', 'https://www.stats.gov.cn/', 'trial'),
    ('50000000-0000-4000-8000-000000000005'::uuid, '60000000-0000-4000-8000-000000000005'::uuid, '20000000-0000-4000-8000-000000000004'::uuid, '比较不同年份的金额时，要注意名义值和实际购买力的区别。', '避免把价格变化误认为真实增长。', '适用于收入、GDP 和长期价格比较。', 'https://www.stats.gov.cn/', 'trial'),
    ('50000000-0000-4000-8000-000000000006'::uuid, '60000000-0000-4000-8000-000000000006'::uuid, '20000000-0000-4000-8000-000000000005'::uuid, '公共服务的成本不会因为用户免费使用就消失。', '理解公共预算和资源取舍。', '免费是用户支付方式，不代表没有社会成本。', 'https://www.gov.cn/', 'trial'),
    ('50000000-0000-4000-8000-000000000007'::uuid, '60000000-0000-4000-8000-000000000007'::uuid, '20000000-0000-4000-8000-000000000001'::uuid, '同一地点的当地时间和世界协调时可以跨越不同日期。', '避免跨国沟通和行程安排中的日期错误。', '适用于跨时区沟通，需要同时确认夏令时。', 'https://www.un.org/zh/', 'trial'),
    ('50000000-0000-4000-8000-000000000008'::uuid, '60000000-0000-4000-8000-000000000008'::uuid, '20000000-0000-4000-8000-000000000003'::uuid, '一条历史时间线只能提供骨架，不能单独解释事件因果。', '提醒读者继续寻找制度、经济和人物背景。', '适用于所有时间线式学习材料。', 'https://www.gov.cn/', 'trial'),
    ('50000000-0000-4000-8000-000000000009'::uuid, '60000000-0000-4000-8000-000000000009'::uuid, '20000000-0000-4000-8000-000000000004'::uuid, 'GDP 增长不意味着每个人的收入以相同比例增长。', '能避免用总量指标替代个人处境。', '需要同时查看人均、分配、价格和就业指标。', 'https://www.stats.gov.cn/', 'expanded_trial'),
    ('50000000-0000-4000-8000-000000000010'::uuid, '60000000-0000-4000-8000-000000000010'::uuid, '20000000-0000-4000-8000-000000000002'::uuid, '人口密度低不必然意味着资源更充足或生活成本更低。', '帮助正确使用人口密度指标。', '还要结合地形、气候、基础设施和产业。', 'https://www.stats.gov.cn/', 'expanded_trial'),
    ('50000000-0000-4000-8000-000000000011'::uuid, '60000000-0000-4000-8000-000000000011'::uuid, '20000000-0000-4000-8000-000000000004'::uuid, '利率变化传导到消费和投资通常需要时间。', '避免把政策变化理解成即时且机械的结果。', '影响方向和速度取决于经济环境与具体利率。', 'https://www.stats.gov.cn/', 'queued_for_review'),
    ('50000000-0000-4000-8000-000000000012'::uuid, '60000000-0000-4000-8000-000000000012'::uuid, '20000000-0000-4000-8000-000000000005'::uuid, '衡量一项公共政策时，要区分目标、工具、执行和结果。', '能让政策讨论更具体。', '适用于公共政策的基础分析，不代替专业评估。', 'https://www.gov.cn/', 'queued_for_review')
), inserted_submissions AS (
  INSERT INTO submissions (
    id, author_id, topic_id, status, trial_started_at, review_queued_at
  )
  SELECT
    id,
    '00000000-0000-4000-8000-000000000002'::uuid,
    topic_id,
    status,
    now() - interval '2 days',
    CASE WHEN status = 'queued_for_review' THEN now() - interval '1 day' ELSE NULL END
  FROM samples
  ON CONFLICT (id) DO NOTHING
  RETURNING id
), available_submissions AS (
  SELECT id FROM inserted_submissions
  UNION
  SELECT s.id
  FROM submissions s
  JOIN samples ON samples.id = s.id
)
INSERT INTO submission_revisions (
  id, submission_id, version, statement, why_useful, applicability, source_url,
  ai_refined_statement, ai_risk_flags, ai_model, ai_prompt_version, created_by
)
SELECT
  samples.revision_id, samples.id, 1, samples.statement, samples.why_useful,
  samples.applicability, samples.source_url, samples.statement,
  '[]'::jsonb, 'deterministic-placeholder', 'submission-screen-v1',
  '00000000-0000-4000-8000-000000000002'::uuid
FROM samples
JOIN available_submissions ON available_submissions.id = samples.id
ON CONFLICT (id) DO NOTHING;

WITH revisions(submission_id, revision_id) AS (
  VALUES
    ('50000000-0000-4000-8000-000000000001'::uuid, '60000000-0000-4000-8000-000000000001'::uuid),
    ('50000000-0000-4000-8000-000000000002'::uuid, '60000000-0000-4000-8000-000000000002'::uuid),
    ('50000000-0000-4000-8000-000000000003'::uuid, '60000000-0000-4000-8000-000000000003'::uuid),
    ('50000000-0000-4000-8000-000000000004'::uuid, '60000000-0000-4000-8000-000000000004'::uuid),
    ('50000000-0000-4000-8000-000000000005'::uuid, '60000000-0000-4000-8000-000000000005'::uuid),
    ('50000000-0000-4000-8000-000000000006'::uuid, '60000000-0000-4000-8000-000000000006'::uuid),
    ('50000000-0000-4000-8000-000000000007'::uuid, '60000000-0000-4000-8000-000000000007'::uuid),
    ('50000000-0000-4000-8000-000000000008'::uuid, '60000000-0000-4000-8000-000000000008'::uuid),
    ('50000000-0000-4000-8000-000000000009'::uuid, '60000000-0000-4000-8000-000000000009'::uuid),
    ('50000000-0000-4000-8000-000000000010'::uuid, '60000000-0000-4000-8000-000000000010'::uuid),
    ('50000000-0000-4000-8000-000000000011'::uuid, '60000000-0000-4000-8000-000000000011'::uuid),
    ('50000000-0000-4000-8000-000000000012'::uuid, '60000000-0000-4000-8000-000000000012'::uuid)
)
UPDATE submissions s
SET current_revision_id = revisions.revision_id
FROM revisions
WHERE s.id = revisions.submission_id AND s.current_revision_id IS NULL;

INSERT INTO submission_votes (submission_id, user_id, value)
SELECT
  submission_id,
  ('70000000-0000-4000-8000-' || lpad(number::text, 12, '0'))::uuid,
  CASE
    WHEN submission_id = '50000000-0000-4000-8000-000000000009'::uuid AND number <= 5 THEN 'useful'
    WHEN submission_id = '50000000-0000-4000-8000-000000000010'::uuid AND number <= 5 THEN 'useful'
    WHEN submission_id = '50000000-0000-4000-8000-000000000011'::uuid AND number <= 16 THEN 'useful'
    WHEN submission_id = '50000000-0000-4000-8000-000000000012'::uuid AND number <= 18 THEN 'useful'
    ELSE 'not_useful'
  END
FROM (
  VALUES
    ('50000000-0000-4000-8000-000000000009'::uuid, 6),
    ('50000000-0000-4000-8000-000000000010'::uuid, 6),
    ('50000000-0000-4000-8000-000000000011'::uuid, 20),
    ('50000000-0000-4000-8000-000000000012'::uuid, 20)
) AS candidates(submission_id, voter_count)
CROSS JOIN LATERAL generate_series(1, candidates.voter_count) AS number
ON CONFLICT (submission_id, user_id) DO NOTHING;

UPDATE submissions s
SET
  useful_count = counts.useful_count,
  not_useful_count = counts.not_useful_count,
  valid_vote_count = counts.useful_count + counts.not_useful_count,
  usefulness_rate = counts.useful_count::numeric / NULLIF(counts.useful_count + counts.not_useful_count, 0)
FROM (
  SELECT
    submission_id,
    count(*) FILTER (WHERE value = 'useful')::int AS useful_count,
    count(*) FILTER (WHERE value = 'not_useful')::int AS not_useful_count
  FROM submission_votes
  WHERE is_valid = true
  GROUP BY submission_id
) counts
WHERE s.id = counts.submission_id;

WITH internal_samples(
  id, revision_id, topic_id, origin_type, trigger_reason,
  statement, why_useful, applicability, source_url
) AS (
  VALUES
    (
      '50000000-0000-4000-8000-000000000013'::uuid,
      '60000000-0000-4000-8000-000000000013'::uuid,
      '20000000-0000-4000-8000-000000000001'::uuid,
      'coverage_gap',
      '覆盖地图发现缺少对地图比例尺的基础解释。',
      '地图比例尺表示图上距离与实际距离之间的缩小关系。',
      '理解比例尺有助于正确判断地图上的距离与细节程度。',
      '不同投影和测量方式会影响精确距离，精确计算应使用合适工具。',
      'https://www.un.org/geospatial/'
    ),
    (
      '50000000-0000-4000-8000-000000000014'::uuid,
      '60000000-0000-4000-8000-000000000014'::uuid,
      '20000000-0000-4000-8000-000000000004'::uuid,
      'maintenance',
      '定期复核发现需要补充名义值与实际值的区别。',
      '比较跨期经济金额时，实际值会剔除价格水平变化，名义值不会。',
      '区分名义值和实际值可以避免把价格上涨误认为真实数量增长。',
      '具体换算依赖选定的价格指数和基期，不同口径不能直接混用。',
      'https://www.stats.gov.cn/'
    )
), inserted_internal AS (
  INSERT INTO submissions (
    id, author_id, topic_id, origin_type, trigger_reason, status, review_queued_at
  )
  SELECT
    id,
    '00000000-0000-4000-8000-000000000001'::uuid,
    topic_id,
    origin_type,
    trigger_reason,
    'queued_for_review',
    now() - interval '12 hours'
  FROM internal_samples
  ON CONFLICT (id) DO NOTHING
  RETURNING id
), available_internal AS (
  SELECT id FROM inserted_internal
  UNION
  SELECT s.id
  FROM submissions s
  JOIN internal_samples ON internal_samples.id = s.id
), inserted_internal_revisions AS (
  INSERT INTO submission_revisions (
    id, submission_id, version, statement, why_useful, applicability, source_url,
    experience_based, ai_disclosure, ai_refined_statement, ai_risk_flags,
    ai_model, ai_prompt_version, created_by
  )
  SELECT
    internal_samples.revision_id,
    internal_samples.id,
    1,
    internal_samples.statement,
    internal_samples.why_useful,
    internal_samples.applicability,
    internal_samples.source_url,
    false,
    true,
    internal_samples.statement,
    '[]'::jsonb,
    'deterministic-placeholder',
    'submission-screen-v1',
    '00000000-0000-4000-8000-000000000001'::uuid
  FROM internal_samples
  JOIN available_internal ON available_internal.id = internal_samples.id
  ON CONFLICT (id) DO NOTHING
  RETURNING id
)
UPDATE submissions s
SET current_revision_id = internal_samples.revision_id
FROM internal_samples
JOIN inserted_internal_revisions ON inserted_internal_revisions.id = internal_samples.revision_id
WHERE s.id = internal_samples.id AND s.current_revision_id IS NULL;
