import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CatalogItem } from './catalog.service';

@Injectable({ providedIn: 'root' })
export class CatalogModalService {
  private subject = new BehaviorSubject<CatalogItem | null>(null);

  get changes() {
    return this.subject.asObservable();
  }

  open(item: CatalogItem | null) {
    try { this.subject.next(item); } catch (e) { /* no-op */ }
  }

  close() {
    try { this.subject.next(null); } catch (e) { /* no-op */ }
  }
}
