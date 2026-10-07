import DemoClient from './demo-client';
import {publicPageMetadata} from '../public-site-metadata.mjs';
export const metadata = publicPageMetadata('/demo');
export default function DemoPage(){return <DemoClient/>;}
