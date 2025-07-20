
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedRoutes = ['/dashboard', '/documents', '/historique', '/maison', '/settings', '/view'];
const authRoutes = ['/login', '/signup'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get('__session');

  // Rediriger vers le tableau de bord si l'utilisateur est connecté et essaie d'accéder aux pages d'authentification
  if (sessionToken && authRoutes.includes(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Rediriger vers la page de connexion si l'utilisateur n'est pas connecté et essaie d'accéder à une route protégée
  if (!sessionToken && protectedRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // Rediriger l'utilisateur de la racine vers le tableau de bord s'il est connecté, sinon vers la page de connexion
  if (pathname === '/') {
    if (sessionToken) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Fait correspondre tous les chemins de requête sauf ceux qui commencent par :
     * - api (routes API)
     * - _next/static (fichiers statiques)
     * - _next/image (optimisation d'image)
     * - favicon.ico (fichier favicon)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
