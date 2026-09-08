import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Pool } from './client.js';

const ownerId = '00000000-0000-4000-8000-000000000001';

const domains = [
  ['geography', '地理', '理解空间、区域、资源与人地关系。'],
  ['history-civilization', '历史与文明', '理解历史证据、文明演变与现代转型。'],
  ['society-law', '政治法律与社会制度', '理解政府、法律、公共服务与社会协作。'],
  ['economy-finance', '经济金融', '理解经济运行、个人财务、商业与就业。'],
  ['math-logic', '数学统计与逻辑', '理解数字、概率、推理与数据表达。'],
  ['natural-science', '物理化学生物', '理解物质、生命、地球、宇宙与环境。'],
  ['health-safety', '健康与生活风险', '理解身体、健康习惯、心理与急救安全。'],
  ['computer-security', '计算机与数字安全', '理解互联网、隐私、网络风险、AI 与数据。'],
  ['engineering-infrastructure', '工程与基础设施', '理解建筑、能源、交通、通信与城市系统。'],
  ['language-communication', '语言表达与沟通', '理解阅读、写作、论证、沟通与媒介。'],
  ['culture-daily-life', '文化艺术与日常生活', '理解文学、艺术、影像与生活文化。'],
  ['current-affairs-context', '时事背景与世界格局', '理解国家、国际组织、公共指标与事件背景。'],
] as const;

const starterKnowledge = [
  ['world-regions', 'seven-continents', '七大洲如何划分', '七大洲是亚洲、非洲、北美洲、南美洲、南极洲、欧洲和大洋洲。', '大洲是依据相连陆地、海洋分隔和历史地理习惯形成的区域。欧洲和亚洲陆地相连，但通常因历史文化和地理传统分作两洲。', 'un'],
  ['world-regions', 'five-oceans', '五大洋如何划分', '五大洋是太平洋、大西洋、印度洋、南冰洋和北冰洋。', '全球海水彼此相连，五大洋是按大陆、海峡和南极周边海域等约定划出的区域。南冰洋通常指环绕南极洲、北至南纬 60° 的海域。', 'un'],
  ['earth-and-maps', 'latitude-longitude', '经纬度如何定位', '纬度表示南北位置，经度表示东西位置，两者共同定位地球表面的地点。', '赤道是 0° 纬线，本初子午线是 0° 经线。纬度最高到南北纬 90°，经度向东、西各到 180°。', 'un'],
  ['earth-and-maps', 'time-zones', '世界协调时与时区', '全球用世界协调时 UTC 作为时间基准，各地再按时区换算当地时间。', '理论上每相差 15° 经度约相差一小时，但实际时区边界会顺着国界和行政区调整；部分地区还使用半小时或四十五分钟时差。', 'un'],
  ['climate-and-earth-systems', 'climate-and-weather', '天气与气候的区别', '天气描述短期大气状态，气候描述一个地区较长时期的统计特征。', '今天是否下雨属于天气；一个地区多年平均温度、降水及其季节变化属于气候。单次寒潮或热浪不能单独证明气候趋势。', 'un'],
  ['china-geography', 'china-terrain-steps', '中国地势三级阶梯', '中国地势总体西高东低，常按平均海拔和主要地形概括为三级阶梯。', '第一级以青藏高原为主体，第二级多高原和盆地，第三级多平原和丘陵。这种格局影响河流流向、交通和人口分布。', 'gov'],
  ['china-geography', 'china-administrative-levels', '中国行政区划层级', '中国行政区划通常按省级、地级、县级和乡级等层级理解。', '各层级的具体名称并不完全相同，例如省级包括省、自治区、直辖市和特别行政区。行政边界用于治理，不等同于自然地理边界。', 'gov'],
  ['china-geography', 'monsoon-climate', '中国季风气候', '中国东部的风向和降水具有明显季节变化，与海陆受热差异形成的季风环流有关。', '夏季风通常带来较多海洋水汽，冬季风较干冷。季风影响显著，但具体天气还受地形、纬度和其他环流共同作用。', 'gov'],
  ['world-regions', 'population-density', '人口密度不等于人口分布', '人口密度是一定区域内人口数量除以面积，用于比较人口聚集程度。', '平均密度会掩盖区域内部差异，也不能单独说明生活质量、资源压力或城市拥挤程度，阅读时要同时看统计范围和空间分布。', 'stats'],
  ['historical-method', 'dynasty-and-era', '朝代与时代不是一回事', '朝代主要描述政权序列，时代则是研究者按共同特征划出的时间范围。', '朝代更替能提供中国历史时间骨架，但社会、经济和文化变化常跨越政权边界，因此不能只用朝代表解释全部历史。', 'gov'],
  ['ancient-china', 'qin-unification', '秦统一', '公元前 221 年，秦结束战国长期割据，建立了中国历史上重要的中央集权国家。', '秦推行郡县制并统一文字、度量衡等制度，对后世国家治理影响深远；但秦朝本身延续时间很短。', 'gov'],
  ['ancient-china', 'silk-road', '丝绸之路不是一条路', '丝绸之路是古代连接中国、中亚、西亚及更远地区的陆海交流网络统称。', '它没有一条永久固定的路线，运输的不只有丝绸，还包括宗教、技术、作物、艺术和疾病等多种事物。', 'un'],
  ['ancient-china', 'imperial-examination', '科举制度如何变化', '科举是中国古代以考试选拔官员的重要制度，在隋唐形成并在后世不断变化。', '考试科目、录取方式和影响范围并非各朝相同。它扩大了部分社会流动机会，也始终受到教育资源和社会条件限制。', 'gov'],
  ['world-civilizations', 'industrial-revolution', '工业革命是一段长期过程', '工业革命指机器生产、能源利用、工厂制度和交通等连续变化，不是某一天突然发生的事件。', '它首先在英国明显展开，后来扩散到其他地区，并深刻改变生产效率、城市化、劳动关系和全球经济格局。', 'un'],
  ['macroeconomy', 'gdp', '国内生产总值能说明什么', 'GDP 衡量一个经济体在一定时期内生产的最终产品和服务的市场价值。', '它适合观察经济总量和增速，但不能独立代表居民收入分配、环境代价、无偿劳动或整体生活质量。', 'stats'],
  ['macroeconomy', 'inflation', '通货膨胀不等于个别商品涨价', '通货膨胀通常指一篮子商品和服务的总体价格水平在一段时间内持续上涨。', '单件商品因短缺而涨价不一定构成通胀。判断时要看价格指数的覆盖范围、权重、持续时间和比较基期。', 'stats'],
  ['personal-finance', 'interest-rate', '利率是资金的价格', '利率表示在一定时期内使用资金的成本或出借资金获得的回报比例。', '利率变化会影响储蓄、借贷、投资和资产价格，但传导通常需要时间，而且不同产品的实际利率并不相同。', 'stats'],
  ['business-trade-and-work', 'unemployment-rate', '就业与失业率', '失业率通常是正在寻找工作但没有工作的人，占劳动力人口的比例。', '它的分母不是全部人口，也不包括所有没有工作的人。理解就业状况还要结合劳动参与率、就业质量和统计口径。', 'stats'],
  ['public-services-and-security', 'public-goods', '公共物品', '公共物品通常具有非排他性和非竞争性，即难以阻止他人使用，一个人使用也不明显减少他人可用数量。', '国防是典型例子。现实中的道路、教育等公共服务往往只部分具备这些特征，不能把“政府提供”直接等同于严格意义的公共物品。', 'gov'],
  ['public-services-and-security', 'tax-and-fiscal-spending', '税收与财政支出', '税收是政府筹集公共资金的重要方式，财政支出则把资金用于公共服务、社会保障、建设和治理。', '财政政策的实际效果取决于收入和支出的结构、时点、执行效率及经济环境，不能只看总金额判断好坏。', 'gov'],
] as const;

const starterRelations = [
  ['seven-continents', 'five-oceans'],
  ['seven-continents', 'population-density'],
  ['latitude-longitude', 'time-zones'],
  ['climate-and-weather', 'monsoon-climate'],
  ['china-terrain-steps', 'monsoon-climate'],
  ['china-terrain-steps', 'population-density'],
  ['china-administrative-levels', 'public-goods'],
  ['china-administrative-levels', 'tax-and-fiscal-spending'],
  ['dynasty-and-era', 'qin-unification'],
  ['qin-unification', 'imperial-examination'],
  ['silk-road', 'industrial-revolution'],
  ['gdp', 'inflation'],
  ['gdp', 'unemployment-rate'],
  ['inflation', 'interest-rate'],
  ['interest-rate', 'tax-and-fiscal-spending'],
  ['public-goods', 'tax-and-fiscal-spending'],
] as const;

interface Catalog {
  topics: { domain: string; slug: string; name: string; target: number }[];
}

export async function seedStarterData(pool: Pool, rootDirectory: string): Promise<void> {
  await pool.query(`
    INSERT IGNORE INTO app_users (id, public_handle, display_name, role, verification_status)
    VALUES ($1, 'site-owner', '站长', 'owner', 'verified')
  `, [ownerId]);

  const domainIds = new Map<string, string>();
  for (const [index, [slug, name, description]] of domains.entries()) {
    const id = `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
    domainIds.set(slug, id);
    await pool.query(`
      INSERT INTO knowledge_domains (id, slug, name, description, sort_order)
      VALUES ($1, $2, $3, $4, $5)
      ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), sort_order = VALUES(sort_order)
    `, [id, slug, name, description, (index + 1) * 10]);
  }

  const catalog = JSON.parse(await readFile(resolve(rootDirectory, 'content/v1/catalog.json'), 'utf8')) as Catalog;
  const topicIds = new Map<string, string>();
  for (const [index, topic] of catalog.topics.entries()) {
    const domainId = domainIds.get(topic.domain);
    if (!domainId) throw new Error(`目录中的领域不存在：${topic.domain}`);
    const id = `22000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
    topicIds.set(topic.slug, id);
    await pool.query(`
      INSERT INTO topics (id, domain_id, slug, name, description, sort_order, v1_target_count)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON DUPLICATE KEY UPDATE domain_id = VALUES(domain_id), name = VALUES(name),
        sort_order = VALUES(sort_order), v1_target_count = VALUES(v1_target_count), is_active = true
    `, [id, domainId, topic.slug, topic.name, topic.name, index + 1, topic.target]);
  }

  const sources = {
    gov: ['80000000-0000-4000-8000-000000000001', '中华人民共和国中央人民政府', '中国政府网公开资料', 'https://www.gov.cn/'],
    stats: ['80000000-0000-4000-8000-000000000002', '国家统计局', '国家统计局公开数据', 'https://www.stats.gov.cn/'],
    un: ['80000000-0000-4000-8000-000000000003', '联合国', '联合国公开资料', 'https://www.un.org/zh/'],
  } as const;
  for (const source of Object.values(sources)) {
    await pool.query(`
      INSERT IGNORE INTO sources (id, publisher, title, url, source_type, license)
      VALUES ($1, $2, $3, $4, 'official', 'link_and_fact_reference_only')
    `, source);
  }

  const nodeIds = new Map<string, string>();
  for (const [index, [topicSlug, slug, title, answer, explanation, sourceKey]] of starterKnowledge.entries()) {
    const topicId = topicIds.get(topicSlug);
    if (!topicId) throw new Error(`首版资料的话题不存在：${topicSlug}`);
    const suffix = String(index + 1).padStart(12, '0');
    const nodeId = `30000000-0000-4000-8000-${suffix}`;
    nodeIds.set(slug, nodeId);
    const revisionId = `40000000-0000-4000-8000-${suffix}`;
    const claimId = `90000000-0000-4000-8000-${suffix}`;
    const sourceId = sources[sourceKey][0];
    const blocks = JSON.stringify([
      { type: 'paragraph', text: answer },
      { type: 'heading', level: 2, text: '进一步理解' },
      { type: 'paragraph', text: explanation },
      { type: 'source', sourceId },
    ]);
    await pool.query(`
      INSERT IGNORE INTO knowledge_nodes
        (id, topic_id, slug, title, summary, status, next_review_at)
      VALUES ($1, $2, $3, $4, $5, 'published', DATE_ADD(now(), INTERVAL 12 MONTH))
    `, [nodeId, topicId, slug, title, answer]);
    await pool.query(`
      INSERT IGNORE INTO knowledge_revisions
        (id, knowledge_node_id, version, content_blocks, change_summary, author_id,
         reviewer_id, review_status, ai_involvement, published_at)
      VALUES ($1, $2, 1, $3, 'MySQL 首版初始化', $4, $4, 'published', 'none', now())
    `, [revisionId, nodeId, blocks, ownerId]);
    await pool.query(`UPDATE knowledge_nodes SET current_revision_id = $2 WHERE id = $1`, [nodeId, revisionId]);
    await pool.query(`
      INSERT IGNORE INTO claims
        (id, knowledge_revision_id, statement, source_id, evidence_locator, verified_by, verified_at)
      VALUES ($1, $2, $3, $4, '', $5, now())
    `, [claimId, revisionId, answer, sourceId, ownerId]);
  }

  const starterNodeIds = [...nodeIds.values()];
  await pool.query(`
    DELETE FROM knowledge_relations
    WHERE origin = 'system_auto' AND from_node_id IN ($1) AND to_node_id IN ($1)
  `, [starterNodeIds]);

  for (const [fromSlug, toSlug] of starterRelations) {
    const fromNodeId = nodeIds.get(fromSlug);
    const toNodeId = nodeIds.get(toSlug);
    if (!fromNodeId || !toNodeId) throw new Error(`首版关系引用了不存在的资料：${fromSlug} -> ${toSlug}`);
    await pool.query(`
      INSERT IGNORE INTO knowledge_relations
        (id, from_node_id, to_node_id, relation_type, strength, origin)
      VALUES (UUID(), $1, $2, 'related_to', 0.75, 'system_auto')
    `, [fromNodeId, toNodeId]);
  }

  const policies = [
    ['submission.expanded_trial', { minimumUseful: 5, minimumNetUseful: 4, minimumUsefulnessRate: 0.7 }],
    ['submission.review_queue', { minimumValidVotes: 20, minimumUsefulnessRate: 0.8 }],
    ['ai.budget', { dailyMinorUnits: 0, monthlyMinorUnits: 0, warningRate: 0.7, degradeRate: 0.9 }],
    ['ai.runtime', { provider: 'rules', model: 'deterministic-placeholder', baseUrl: null, maxInputChars: 12000, maxOutputTokens: 800 }],
  ] as const;
  for (const [key, value] of policies) {
    await pool.query('INSERT IGNORE INTO policy_config (`key`, `value`) VALUES ($1, $2)', [key, JSON.stringify(value)]);
  }
}
