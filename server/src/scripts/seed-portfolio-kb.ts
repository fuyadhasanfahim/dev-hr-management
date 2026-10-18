/**
 * Loads Webbriks' delivered client work into the AI knowledge base, grouped by type of app, so the
 * WhatsApp AI can point customers to the closest examples. Re-running replaces the "Portfolio" entries.
 * Run from server/:  node --import tsx src/scripts/seed-portfolio-kb.ts [--dry]
 */
import { prisma } from '../lib/prisma.js';
import knowledgeBaseService from '../services/knowledge-base.service.js';

const FOREIGN = 'Portfolio - International Clients';
const BD = 'Portfolio - Bangladesh Clients';
const TIP = 'Share only the 2-3 closest links to what the customer wants to build, then ask about their own business.';

const entries: { source: string; text: string }[] = [
    {
        source: 'Portfolio - Overview',
        text: `Webbriks portfolio overview: we have delivered websites and web apps for international clients (Kuwait, Germany, Italy and more) and for many Bangladeshi brands. Types of work: fashion and lifestyle e-commerce, large multi-category online shops, furniture and equipment stores, custom-print stores, travel and tour booking, and wellness apps. When a customer asks for previous work or samples, ${TIP}`,
    },
    {
        source: FOREIGN,
        text: `International client work - fashion and designer e-commerce: THAHAB Kuwait (thahab.com, luxury fashion, bags, shoes and home with worldwide delivery), Massimo Dutti store (massimodutti.com), Marandino (marandino.de, Germany, designer boutique online shop), Filippo Marchesani (filippomarchesani.com, Italy, designer clothes, bags and shoes), Greenbomb (greenbomb.de, Germany, sustainable fashion shop). Use these when a customer wants a fashion, boutique or brand online store, especially for overseas customers. ${TIP}`,
    },
    {
        source: FOREIGN,
        text: `International client work - baby, kids and lifestyle brands: Tesa Babe (tesababe.com, bamboo cotton clothing and loungewear for babies, kids and parents), Blenders Eyewear (blenderseyewear.com, eyewear brand store), Terra Outdoor Living (terraoutdoor.com, contemporary outdoor and patio furniture collections). Use these when a customer sells baby products, accessories, furniture or a premium consumer brand abroad. ${TIP}`,
    },
    {
        source: BD,
        text: `Bangladesh client work - fashion and clothing e-commerce: Flexzon (flexzonbd.com, fashion e-commerce platform), Pannas Collection (pannascollection.com, borkha and khimar), Lunelle (lunelle.baby, organic cotton baby clothing), Trenzo (trenzobd.com, modern accessories and bags). Use these when a customer wants a clothing, modest-wear, baby-wear or accessories store in Bangladesh. ${TIP}`,
    },
    {
        source: BD,
        text: `Bangladesh client work - lifestyle and custom-product stores: Professor Lifestyle (professorlifestyle.com, leather products), Viscositee (viscositee.com, customized T-shirt printing service), Hossain Furniture BD (hossainfurniturebd.com, furniture store). Use these for customers selling leather goods, custom or print-on-demand products, or furniture and home items. ${TIP}`,
    },
    {
        source: BD,
        text: `Bangladesh client work - large online shop and equipment supplier: KinoBD (kinobd.com, a large multi-category e-commerce shop) and TrueSense (truesensebd.com, medical equipment supplier). Use these when a customer needs a big catalog with many categories or products, or a B2B and equipment supply website. ${TIP}`,
    },
    {
        source: BD,
        text: `Client work - travel and wellness apps: Travelora (travelora.us, a tour and travel experience discovery and booking website) and AyurLife (ayurlif.com, a face yoga app and platform with exercises and routines). Use these when a customer wants a travel or tour booking website, or a health, wellness or subscription-style app or platform. ${TIP}`,
    },
];

async function main() {
    if (process.argv.includes('--dry')) return console.log(entries.map((e) => `${e.text.length} ${e.source}`).join('\n'));
    const del = await prisma.$executeRaw`DELETE FROM knowledge_chunks WHERE source LIKE 'Portfolio - %'`;
    for (const e of entries) await knowledgeBaseService.createChunk(e.text, e.source, 'Portfolio import');
    console.log(`replaced ${del}, inserted ${entries.length}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
