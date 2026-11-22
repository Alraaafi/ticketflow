import { Link } from 'react-router-dom';
import { Ticket } from 'lucide-react';
import { EmptyState } from '../components/ui';

export default function NotFound() {
  return <EmptyState icon={Ticket} title="Page not found" text="This page does not exist." action={<Link to="/" className="btn-primary">Browse events</Link>} />;
}
