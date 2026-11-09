import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';

export function NavMain({ items = [] }: { items: NavItem[] }) {
    const page = usePage();
    const [activeHash, setActiveHash] = useState('');

    useEffect(() => {
        const syncHash = () => setActiveHash(window.location.hash);
        syncHash();
        window.addEventListener('hashchange', syncHash);

        return () => window.removeEventListener('hashchange', syncHash);
    }, []);

    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                            asChild
                            isActive={
                                item.url.includes('#')
                                    ? activeHash === item.url.slice(item.url.indexOf('#'))
                                    : page.url.split('#')[0] === item.url && !activeHash
                            }
                        >
                            {item.url.includes('#') ? (
                                <a href={item.url} onClick={() => window.dispatchEvent(new Event('mobile-navigation'))}>
                                    {item.icon && <item.icon />}
                                    <span>{item.title}</span>
                                </a>
                            ) : (
                                <Link href={item.url} prefetch>
                                    {item.icon && <item.icon />}
                                    <span>{item.title}</span>
                                </Link>
                            )}
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}
