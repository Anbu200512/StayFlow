import { Link } from 'react-router-dom';
import { PageIntro } from '../components/States';

export default function NotFoundPage() { return <><PageIntro eyebrow="404" title="That page has wandered off." description="The link may be old, or the page may have moved." /><div className="px-5 pb-24 lg:px-10"><Link to="/" className="button-primary">Return home</Link></div></>; }
