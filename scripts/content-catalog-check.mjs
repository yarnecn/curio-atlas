import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const catalogPath = resolve(import.meta.dirname, '../content/v1/catalog.json');
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const slugs = new Set();
const titles = new Set();
const domains = new Set();
const topics = new Set();
let total = 0;

for (const topic of catalog.topics) {
  if (!topic.domain || !topic.name) throw new Error(`${topic.slug}: domain and name are required`);
  if (topics.has(topic.slug)) throw new Error(`Duplicate topic slug: ${topic.slug}`);
  topics.add(topic.slug);
  domains.add(topic.domain);
  if (topic.nodes.length !== topic.target) {
    throw new Error(`${topic.slug}: expected ${topic.target} nodes, found ${topic.nodes.length}`);
  }
  for (const [slug, title] of topic.nodes) {
    if (!slug || !title) throw new Error(`${topic.slug}: node slug and title are required`);
    if (slugs.has(slug)) throw new Error(`Duplicate node slug: ${slug}`);
    if (titles.has(title)) throw new Error(`Duplicate node title: ${title}`);
    slugs.add(slug);
    titles.add(title);
    total += 1;
  }
}

if (domains.size !== catalog.domainTarget) {
  throw new Error(`Expected ${catalog.domainTarget} domains, found ${domains.size}`);
}

if (topics.size !== catalog.topicTarget) {
  throw new Error(`Expected ${catalog.topicTarget} topics, found ${topics.size}`);
}

if (total !== catalog.stableTarget) {
  throw new Error(`Expected ${catalog.stableTarget} stable nodes, found ${total}`);
}

console.log(`V1 content catalog check passed (${domains.size} domains, ${topics.size} topics, ${total} stable nodes).`);
