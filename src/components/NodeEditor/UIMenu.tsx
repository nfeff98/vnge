import { useRef, useState } from 'react';
import { Menu as MenuIcon } from 'lucide-react';
import { ControlledMenu, MenuItem, useHover } from '@szhsin/react-menu';
import '@szhsin/react-menu/dist/index.css';

interface MenuElement {
    title: string;
    callback?: () => void;
    subItems?: { title: string; callback?: () => void }[];
    disabled?: boolean;
}

function HoverMenuItem({ element }: { element: MenuElement }) {
    const ref = useRef<HTMLElement>(null);
    const [isOpen, setOpen] = useState(false);
    const { anchorProps, hoverProps } = useHover(isOpen, setOpen);

    return (
        <>
            <button
                ref={ref as React.RefObject<HTMLButtonElement>}
                {...anchorProps}
                className="menu-button px-3 py-1 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={element.disabled}
            >
                {element.title}
            </button>
            <ControlledMenu
                {...hoverProps}
                state={isOpen ? 'open' : 'closed'}
                anchorRef={ref as React.RefObject<Element>}
                onClose={() => setOpen(false)}
                direction="bottom"
                align="start"
                menuStyle={{
                    transform: 'translateY(9px)',
                }}
            >
                {element.subItems ? (
                    element.subItems.map((subItem) => (
                        <MenuItem
                            key={subItem.title}
                            onClick={subItem.callback}
                        >
                            {subItem.title}
                        </MenuItem>
                    ))
                ) : (
                    <MenuItem onClick={element.callback}>
                        {element.title}
                    </MenuItem>
                )}
            </ControlledMenu>
        </>
    );
}

export default function UIMenu() {
    const menuElements: MenuElement[] = [
        {
            title: 'File',
            subItems: [
                { title: 'New', callback: () => console.log('New') },
                { title: 'Open', callback: () => console.log('Open') },
                { title: 'Save', callback: () => console.log('Save') },
                { title: 'Save As', callback: () => console.log('Save As') },
            ]
        },
        { title: 'Browse', callback: () => console.log('Browse'), disabled: true },
        { title: 'Window', callback: () => console.log('Window'), disabled: true },
        { title: 'Settings', callback: () => console.log('Settings'), disabled: true },
        { title: 'Help', callback: () => console.log('Help'), disabled: true },
        { title: 'About', callback: () => console.log('About'), disabled: true },
    ];

    return (
        <div className="absolute top-0 left-0 z-50 py-0 bg-white rounded-none rounded-br-2xl px-0 shadow-2xl hover:bg-gray-100 transition-all group hover:p-2">
            <div className='flex items-center justify-center pl-2 pr-1 group-hover:pr-0'>
                <MenuIcon className="w-6 h-6 min-w-6 min-h-6" />
                <div className='group-hover:pl-4 pl-1 w-0 opacity-0 group-hover:w-[570px] overflow-clip text-nowrap flex flex-nowrap group-hover:opacity-100 transition-all duration-300 gap-4 items-center justify-center'>
                    {menuElements.map((element) => (
                        <HoverMenuItem key={element.title} element={element} />
                    ))}
                </div>
            </div>
        </div>
    );
}

