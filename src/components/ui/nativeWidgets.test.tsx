import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

describe('native-based UI primitives', () => {
  it('menu: opens from the trigger, arrow keys move, Enter selects and closes', async () => {
    const onA = vi.fn()
    const onB = vi.fn()
    const user = userEvent.setup()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onA}>A</DropdownMenuItem>
          <DropdownMenuItem onSelect={onB}>B</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    const trigger = screen.getByRole('button', { name: 'Actions' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menuitem', { name: 'A' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'B' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'A' })).toHaveFocus()
    await user.keyboard('{End}{Enter}')
    expect(onB).toHaveBeenCalledOnce()
    expect(onA).not.toHaveBeenCalled()
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()

    await user.click(trigger)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  })

  it('dialog: labelled by its title, Escape asks the parent to close', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [open, setOpen] = useState(true)
      return (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogTitle>Titre</DialogTitle>
            <DialogDescription>Texte</DialogDescription>
          </DialogContent>
        </Dialog>
      )
    }
    render(<Harness />)
    const dialog = screen.getByRole('dialog', { name: 'Titre' })
    expect(dialog).toHaveAccessibleDescription('Texte')
    await user.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('tabs: roving tabindex and Home/End keys', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [value, setValue] = useState('a')
      return (
        <Tabs value={value} onValueChange={setValue}>
          <TabsList aria-label="Onglets">
            <TabsTrigger value="a">A</TabsTrigger>
            <TabsTrigger value="b">B</TabsTrigger>
            <TabsTrigger value="c">C</TabsTrigger>
          </TabsList>
          <TabsContent value="a">Contenu A</TabsContent>
          <TabsContent value="c">Contenu C</TabsContent>
        </Tabs>
      )
    }
    render(<Harness />)
    expect(screen.getByRole('tab', { name: 'A' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'B' })).toHaveAttribute('tabindex', '-1')
    await user.tab()
    expect(screen.getByRole('tab', { name: 'A' })).toHaveFocus()
    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'C' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: 'C' })).toHaveTextContent('Contenu C')
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'A' })).toHaveFocus()
  })
})
