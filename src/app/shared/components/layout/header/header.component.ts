import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { NgFor, NgIf, CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NavItem } from '../../../../core/models/navigation';

@Component({
  selector: 'pros-layout-header',
  standalone: true,
  imports: [NgFor, NgIf, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  @Input({ required: true }) navItems: NavItem[] = [];
  @Input() showAccount = true;
  @Input() isAuthenticated = false;
  @Input() userLabel = 'Conta';
  @Input() userEmail = '';
  @Input() isProfileComplete = false;
  @Input() accountMenuItems: Array<{ id: string; label: string; icon: string }> = [];
  @Output() accountClick = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();
  @Output() menuItemClick = new EventEmitter<string>();

  isMenuOpen = signal<boolean>(false);

  trackByLabel(_: number, item: NavItem): string {
    return item.label;
  }

  toggleMenu(): void {
    this.isMenuOpen.update(v => !v);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  selectMenuItem(id: string): void {
    this.menuItemClick.emit(id);
    this.closeMenu();
  }

  doLogout(): void {
    this.logout.emit();
    this.closeMenu();
  }
}
