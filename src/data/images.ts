import type { ImageMetadata } from 'astro';
import pipeWrenches from '@/assets/stock/stock-pixabay-840835-pipe-wrenches.jpg';
import electrician from '@/assets/stock/stock-pixabay-3273340-electrician-wiring.jpg';
import carpenter from '@/assets/stock/stock-pixabay-2385634-carpenter-plane.jpg';
import kneeling from '@/assets/stock/stock-pixabay-2598802-man-kneeling-chapel.jpg';
import vanSmallHouse from '@/assets/stock/stock-pixabay-1834826-van-small-house.jpg';
import handsElderly from '@/assets/stock/stock-pixabay-2906458-hands-elderly.jpg';
import smovExterior from '@/assets/stock/stock-wikimedia-smov-exterior.jpg';

/**
 * Every image on the site is looked up here by a semantic slot. Swap a stock
 * file for Guild photography by changing one line. `src: null` renders a
 * blocked-out region with the alt text visible, and is listed in CONTENT-TODO.
 * Stock files live in src/assets/stock with credits in stock-credits.json.
 */
export type ImageSlot = {
  src: ImageMetadata | null;
  alt: string;
  credit?: string;
};

export const images = {
  heroPoster: {
    src: pipeWrenches,
    alt: 'Two pipe wrenches clamped on a length of galvanized pipe, with a tube cutter beside them',
    credit: 'stevepb, Pixabay',
  },
  guildAtWork: {
    src: handsElderly,
    alt: "A younger hand resting gently on an elderly woman's folded hands",
    credit: 'sabinevanerp, Pixabay',
  },
  foundingStory: {
    src: vanSmallHouse,
    alt: 'An old van parked at the curb in front of a small house',
    credit: 'Pexels, Pixabay',
  },
  spiritual: {
    src: kneeling,
    alt: 'A man kneeling alone in prayer between the pews of an empty church',
    credit: 'Pixabay',
  },
  electrician: {
    src: electrician,
    alt: "An electrician's hands fastening wires inside an open panel",
    credit: 'Sid74, Pixabay',
  },
  carpenter: {
    src: carpenter,
    alt: 'A hand plane and shavings on a workbench',
    credit: 'Pixabay',
  },
  meetingPlace: {
    src: smovExterior,
    alt: 'Exterior of Saint Mary of Victories Catholic Church in St. Louis, red brick with arched windows',
    // CC BY-SA 4.0: the credit must stay visible (WhereWeMeet.astro shows it).
    credit: 'Nheyob, CC BY-SA 4.0, via Wikimedia Commons',
  },
  memberPortrait: {
    src: null,
    alt: 'Portrait of a Guild member at their shop or on a job site',
  },
} satisfies Record<string, ImageSlot>;

export type ImageKey = keyof typeof images;
