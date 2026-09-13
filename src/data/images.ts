import type { ImageMetadata } from 'astro';
import pipeWrenches from '@/assets/stock/stock-pixabay-840835-pipe-wrenches.jpg';
import electrician from '@/assets/stock/stock-pixabay-3273340-electrician-wiring.jpg';
import carpenter from '@/assets/stock/stock-pixabay-2385634-carpenter-plane.jpg';
import kneeling from '@/assets/stock/stock-pixabay-2598802-man-kneeling-chapel.jpg';

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
    src: null,
    alt: 'A Guild tradesman shaking hands with a homeowner at the front door after a repair',
  },
  foundingStory: {
    src: null,
    alt: "A plumber's work van parked at the curb of a small, weathered house",
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
    src: null,
    alt: 'Exterior of Saint Mary of Victories Catholic Church in St. Louis',
  },
  memberPortrait: {
    src: null,
    alt: 'Portrait of a Guild member at their shop or on a job site',
  },
} satisfies Record<string, ImageSlot>;

export type ImageKey = keyof typeof images;
