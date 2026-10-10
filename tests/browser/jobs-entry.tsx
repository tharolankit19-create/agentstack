// Test-only host for the production component; never imported by Next.js.
import {createRoot} from 'react-dom/client';
import {JobsWorkspace} from '../../apps/web/src/components/jobs/workspace';
createRoot(document.getElementById('root')!).render(<JobsWorkspace/>);
