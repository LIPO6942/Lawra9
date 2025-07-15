'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';

const AppleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 20.94c1.5 0 2.75 1.06 4 0c1.25-1.06 2.5-2.25 2.5-4.38c0-1.25-.75-2.5-2.25-2.5c-.75 0-1.5.5-2 .5c-.5 0-1.25-.5-2-.5c-1.5 0-2.25 1.25-2.25 2.5c0 2.13 1.25 3.32 2.5 4.38z" />
    <path d="M12 20.94c-1.5 0-2.75 1.06-4 0c-1.25-1.06-2.5-2.25-2.5-4.38c0-1.25.75-2.5 2.25-2.5c.75 0 1.5.5 2 .5c.5 0 1.25-.5 2-.5c1.5 0 2.25 1.25 2.25 2.5c0 2.13-1.25 3.32-2.5 4.38z" />
    <path d="M16 8.05C14.5 6.55 13.25 6 12 6s-2.5.55-4 2.05" />
    <path d="M12 6c0-2-1.5-3.5-3.5-3.5s-3.5 1.5-3.5 3.5" />
  </svg>
);

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 11.5c1.38 0 2.5-1.12 2.5-2.5S13.38 6.5 12 6.5s-2.5 1.12-2.5 2.5 1.12 2.5 2.5 2.5z" />
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
        <path d="M20.94 11h-2.06c-.14-1.05-.45-2.03-.9-2.9l1.47-1.47c.78.96 1.39 2.11 1.77 3.37h-0.28zM3.06 11H5.12c.14-1.05.45-2.03.9-2.9L4.55 6.63c-.78.96-1.39 2.11-1.77 3.37h0.28z" />
    </svg>
);


export default function LoginPage() {
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock login logic
    router.push('/dashboard');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-sm mx-auto shadow-2xl rounded-2xl bg-card">
        <CardHeader className="text-center">
          <h1 className="text-4xl font-bold font-headline text-primary-foreground tracking-tighter">Lawra9</h1>
          <CardDescription className="pt-2">Gérez toute votre paperasse en un seul endroit.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="email@exemple.com" required className="rounded-lg"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" required className="rounded-lg"/>
            </div>
            <Button type="submit" className="w-full font-bold rounded-lg bg-accent text-accent-foreground hover:bg-accent/90">Se connecter</Button>
          </form>
          <div className="my-4 flex items-center">
            <div className="flex-grow border-t border-muted" />
            <span className="mx-4 text-xs text-muted-foreground">OU</span>
            <div className="flex-grow border-t border-muted" />
          </div>
          <div className="space-y-2">
             <Button variant="outline" className="w-full rounded-lg">
                <GoogleIcon className="mr-2 h-5 w-5" />
                Continuer avec Google
              </Button>
              <Button variant="outline" className="w-full rounded-lg">
                <AppleIcon className="mr-2 h-5 w-5" />
                Continuer avec Apple
              </Button>
          </div>
        </CardContent>
        <CardFooter className="justify-center text-sm">
          <p>Pas de compte? <a href="#" className="font-semibold text-accent hover:underline">S'inscrire</a></p>
        </CardFooter>
      </Card>
    </div>
  );
}
