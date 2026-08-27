document.addEventListener('DOMContentLoaded', () => {
    // State management
    let releaseNotes = [];
    let activeTypeFilter = 'all';
    let searchQuery = '';
    let selectedUpdate = null;

    // DOM Elements
    const refreshBtn = document.getElementById('refresh-btn');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const retryBtn = document.getElementById('retry-btn');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const filterContainer = document.getElementById('filter-container');
    const feedLoadingState = document.getElementById('feed-loading-state');
    const feedErrorState = document.getElementById('feed-error-state');
    const feedEmptyState = document.getElementById('feed-empty-state');
    const feedContentArea = document.getElementById('feed-content-area');
    const errorMessage = document.getElementById('error-message');
    const cacheIndicator = document.getElementById('cache-indicator');
    const cacheTimeText = document.getElementById('cache-time-text');
    const toastContainer = document.getElementById('toast-container');

    // Composer Elements
    const composerEmptyState = document.getElementById('composer-empty-state');
    const composerActiveState = document.getElementById('composer-active-state');
    const composerDate = document.getElementById('composer-update-date');
    const composerBadge = document.getElementById('composer-update-badge');
    const tweetTextarea = document.getElementById('tweet-text');
    const charRingProgress = document.getElementById('char-ring-progress');
    const charCountNum = document.getElementById('char-count-num');
    const tweetLivePreview = document.getElementById('tweet-live-preview');
    const deselectBtn = document.getElementById('deselect-btn');
    const copyBtn = document.getElementById('copy-btn');
    const tweetBtn = document.getElementById('tweet-btn');
    const hashtagBtns = document.querySelectorAll('.hashtag-btn');

    // Character counter configuration
    const TWITTER_CHAR_LIMIT = 280;
    const RING_CIRCUMFERENCE = 2 * Math.PI * 14; // r = 14 => ~87.96

    // Set initial dashoffset
    if (charRingProgress) {
        charRingProgress.style.strokeDasharray = `${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`;
        charRingProgress.style.strokeDashoffset = RING_CIRCUMFERENCE;
    }

    // Initialize
    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme);
    fetchReleaseNotes();

    // Event Listeners
    refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));
    retryBtn.addEventListener('click', () => fetchReleaseNotes(true));
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', exportToCSV);
    }
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(newTheme);
            localStorage.setItem('theme', newTheme);
            showToast(`Switched to ${newTheme} mode!`, 'info');
        });
    }
    deselectBtn.addEventListener('click', closeComposer);

    // Search input handlers
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        toggleClearButton();
        renderFeed();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        toggleClearButton();
        renderFeed();
        searchInput.focus();
    });

    function toggleClearButton() {
        if (searchQuery.length > 0) {
            clearSearchBtn.classList.remove('hidden');
        } else {
            clearSearchBtn.classList.add('hidden');
        }
    }

    // Textarea input handler
    tweetTextarea.addEventListener('input', () => {
        updateCharCounter();
        updateLivePreview();
    });

    // Hashtag button click handlers
    hashtagBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tag = btn.dataset.tag;
            let currentText = tweetTextarea.value;
            
            // Check if hashtag is already present
            if (!currentText.includes(tag)) {
                // Add tag nicely
                if (currentText.endsWith('\n') || currentText.endsWith(' ')) {
                    tweetTextarea.value = currentText + tag;
                } else if (currentText === '') {
                    tweetTextarea.value = tag;
                } else {
                    tweetTextarea.value = currentText + ' ' + tag;
                }
                updateCharCounter();
                updateLivePreview();
                showToast(`Added ${tag}`, 'success');
            } else {
                showToast(`Tag ${tag} is already in the draft`, 'warning');
            }
        });
    });

    // Copy to clipboard
    copyBtn.addEventListener('click', () => {
        const text = tweetTextarea.value;
        navigator.clipboard.writeText(text).then(() => {
            showToast('Tweet draft copied to clipboard!', 'success');
            
            // Temporary button animation feedback
            const btnSpan = copyBtn.querySelector('span');
            const originalText = btnSpan.textContent;
            btnSpan.textContent = 'Copied!';
            copyBtn.style.borderColor = 'var(--color-feature)';
            
            setTimeout(() => {
                btnSpan.textContent = originalText;
                copyBtn.style.borderColor = '';
            }, 2000);
        }).catch(err => {
            showToast('Failed to copy text', 'error');
            console.error('Copy error:', err);
        });
    });

    // Open X/Twitter Intent
    tweetBtn.addEventListener('click', () => {
        const text = tweetTextarea.value;
        const currentLen = text.length;

        if (currentLen === 0) {
            showToast('Tweet is empty!', 'error');
            return;
        }

        if (currentLen > TWITTER_CHAR_LIMIT) {
            showToast('Tweet exceeds X/Twitter character limit!', 'error');
            return;
        }

        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterUrl, '_blank', 'noopener,noreferrer');
        showToast('Opening X/Twitter...', 'success');
    });

    // Fetch releases API
    function fetchReleaseNotes(forceRefresh = false) {
        showLoadingState();
        
        // Spin the refresh icon
        const spinner = refreshBtn.querySelector('.spinner-icon');
        spinner.classList.add('spinning');
        refreshBtn.disabled = true;

        const url = `/api/release-notes${forceRefresh ? '?refresh=true' : ''}`;

        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                return res.json();
            })
            .then(resData => {
                if (resData.error) {
                    throw new Error(resData.error);
                }

                releaseNotes = resData.data || [];
                
                // Show cache indicator if applicable
                if (resData.cached_at) {
                    const date = new Date(resData.cached_at * 1000);
                    const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    cacheTimeText.textContent = `${resData.is_cached ? 'Cached' : 'Retrieved'} at ${formattedTime}`;
                    cacheIndicator.classList.remove('hidden');
                } else {
                    cacheIndicator.classList.add('hidden');
                }

                if (resData.warning) {
                    showToast(resData.warning, 'warning');
                } else if (forceRefresh) {
                    showToast('Feed refreshed successfully!', 'success');
                }

                // Render dynamic filter buttons and the main notes list
                setupFilters();
                renderFeed();
                
                // If we forced refresh, check if our currently selected item still exists
                if (selectedUpdate) {
                    findAndReselectUpdate();
                }
            })
            .catch(err => {
                console.error('Fetch error:', err);
                errorMessage.textContent = err.message || 'An error occurred while fetching the release notes.';
                showErrorState();
                showToast('Failed to retrieve release notes.', 'error');
            })
            .finally(() => {
                spinner.classList.remove('spinning');
                refreshBtn.disabled = false;
            });
    }

    // UI State Toggles
    function showLoadingState() {
        feedLoadingState.classList.remove('hidden');
        feedErrorState.classList.add('hidden');
        feedEmptyState.classList.add('hidden');
        feedContentArea.classList.add('hidden');
    }

    function showErrorState() {
        feedLoadingState.classList.add('hidden');
        feedErrorState.classList.remove('hidden');
        feedEmptyState.classList.add('hidden');
        feedContentArea.classList.add('hidden');
    }

    function setupFilters() {
        // Collect all types and their frequencies
        const counts = { all: 0 };
        
        releaseNotes.forEach(entry => {
            entry.updates.forEach(upd => {
                const type = upd.type || 'Update';
                counts.all++;
                counts[type] = (counts[type] || 0) + 1;
            });
        });

        // Regenerate filter badges
        const badgesHtml = [];
        
        // Always include 'All' badge
        badgesHtml.push(`
            <button class="filter-badge ${activeTypeFilter === 'all' ? 'active' : ''}" data-type="all" id="filter-all">
                All <span class="badge-count" id="count-all">${counts.all}</span>
            </button>
        `);

        // Sort other categories alphabetically
        const sortedTypes = Object.keys(counts).filter(k => k !== 'all').sort();
        
        sortedTypes.forEach(type => {
            badgesHtml.push(`
                <button class="filter-badge ${activeTypeFilter === type ? 'active' : ''}" data-type="${type}">
                    ${type} <span class="badge-count">${counts[type]}</span>
                </button>
            `);
        });

        filterContainer.innerHTML = badgesHtml.join('');

        // Re-attach listeners to dynamic badges
        filterContainer.querySelectorAll('.filter-badge').forEach(badge => {
            badge.addEventListener('click', (e) => {
                // Workaround if click targets inner count span
                const targetBtn = e.target.closest('.filter-badge');
                if (!targetBtn) return;
                
                filterContainer.querySelectorAll('.filter-badge').forEach(b => b.classList.remove('active'));
                targetBtn.classList.add('active');
                
                activeTypeFilter = targetBtn.dataset.type;
                renderFeed();
            });
        });
    }

    // Render Feed List
    function renderFeed() {
        feedLoadingState.classList.add('hidden');
        
        // Filter elements
        let totalMatched = 0;
        const filteredGroupsHtml = [];

        releaseNotes.forEach(entry => {
            const matchedUpdates = entry.updates.filter(upd => {
                const matchesType = (activeTypeFilter === 'all' || upd.type === activeTypeFilter);
                const matchesSearch = !searchQuery || 
                    upd.type.toLowerCase().includes(searchQuery) ||
                    upd.text.toLowerCase().includes(searchQuery) ||
                    entry.title.toLowerCase().includes(searchQuery);
                return matchesType && matchesSearch;
            });

            if (matchedUpdates.length > 0) {
                totalMatched += matchedUpdates.length;

                // Build date group
                const updatesHtml = matchedUpdates.map(upd => {
                    // Unique local ID for card element
                    const cardId = `card-${entry.title.replace(/\s+/g, '-').replace(/,/g, '')}-${upd.type}-${entry.updates.indexOf(upd)}`;
                    const isSelected = selectedUpdate && selectedUpdate.id === cardId;
                    
                    const badgeClass = `badge-${(upd.type || 'Update').toLowerCase()}`;
                    
                    return `
                        <article class="update-card ${isSelected ? 'selected' : ''}" id="${cardId}" data-date="${entry.title}" data-type="${upd.type}" data-link="${entry.link}">
                            <div class="card-header">
                                <span class="badge ${badgeClass}">${upd.type}</span>
                                <div class="card-actions">
                                    <button class="action-icon-btn copy-card-btn" title="Copy update text to clipboard" aria-label="Copy update text">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                        </svg>
                                    </button>
                                    <button class="action-icon-btn share-btn" title="Draft tweet about this update" aria-label="Compose tweet">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon">
                                            <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <div class="card-body">
                                ${upd.html}
                            </div>
                        </article>
                    `;
                }).join('');

                filteredGroupsHtml.push(`
                    <div class="release-group">
                        <div class="release-group-title">
                            <span>${entry.title}</span>
                            <a href="${entry.link}" target="_blank" class="release-group-link" title="Open official GCP Release Notes documentation">
                                <span>Official Docs</span>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                                </svg>
                            </a>
                        </div>
                        ${updatesHtml}
                    </div>
                `);
            }
        });

        if (totalMatched === 0) {
            feedEmptyState.classList.remove('hidden');
            feedContentArea.classList.add('hidden');
        } else {
            feedEmptyState.classList.add('hidden');
            feedContentArea.innerHTML = filteredGroupsHtml.join('');
            feedContentArea.classList.remove('hidden');
            
            // Attach card click handlers
            attachCardHandlers();
        }
    }

    // Attach Click Handlers to Update Cards
    function attachCardHandlers() {
        feedContentArea.querySelectorAll('.update-card').forEach(card => {
            // Clicking the card itself
            card.addEventListener('click', (e) => {
                // If they clicked the share/copy button or link inside the card body, avoid double action triggers
                if (e.target.closest('a') || e.target.closest('.share-btn') || e.target.closest('.copy-card-btn')) {
                    if (e.target.closest('.share-btn')) {
                        selectCard(card);
                    }
                    return;
                }
                
                selectCard(card);
            });

            // Click listener for the card-specific copy button
            card.querySelectorAll('.copy-card-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent card selection click event
                    const textContent = card.querySelector('.card-body').innerText.trim();
                    navigator.clipboard.writeText(textContent).then(() => {
                        showToast('Update text copied to clipboard!', 'success');
                    }).catch(err => {
                        showToast('Failed to copy text', 'error');
                        console.error('Copy card error:', err);
                    });
                });
            });
        });
    }

    // Select Card Logic
    function selectCard(card) {
        // Clear previous selections
        feedContentArea.querySelectorAll('.update-card').forEach(c => c.classList.remove('selected'));
        
        card.classList.add('selected');
        
        const cardId = card.id;
        const date = card.dataset.date;
        const type = card.dataset.type;
        const link = card.dataset.link;
        // Extract text
        const textContent = card.querySelector('.card-body').innerText;

        selectedUpdate = {
            id: cardId,
            date: date,
            type: type,
            link: link,
            text: textContent
        };

        // Open composer panel
        openComposer(selectedUpdate);
    }

    // Open Tweet Composer
    function openComposer(update) {
        composerEmptyState.classList.add('hidden');
        composerActiveState.classList.remove('hidden');
        
        composerDate.textContent = update.date;
        composerBadge.textContent = update.type;
        
        // Remove old classes and add appropriate type badge color class
        composerBadge.className = 'badge';
        composerBadge.classList.add(`badge-${update.type.toLowerCase()}`);

        // Construct pre-filled tweet draft
        tweetTextarea.value = draftTweetText(update);
        
        updateCharCounter();
        updateLivePreview();
        
        // Smooth scroll to composer on small screens
        if (window.innerWidth <= 1024) {
            composerActiveState.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    // Close Tweet Composer
    function closeComposer() {
        composerEmptyState.classList.remove('hidden');
        composerActiveState.classList.add('hidden');
        
        // Deselect current card in feed
        if (selectedUpdate) {
            const card = document.getElementById(selectedUpdate.id);
            if (card) card.classList.remove('selected');
        }
        
        selectedUpdate = null;
    }

    // Auto-compose tweet draft text
    function draftTweetText(update) {
        // Strip out links inside the text or truncate to fit
        let text = update.text;
        
        // Replace multiple newlines or spaces with simple spacing
        text = text.replace(/\s+/g, ' ').trim();
        
        // Truncate text block if it is too long to leave space for template and tags
        const availableSpace = TWITTER_CHAR_LIMIT - 110; // Reserve characters for intro and link
        if (text.length > availableSpace) {
            text = text.substring(0, availableSpace - 3) + '...';
        }

        return `🚀 BigQuery ${update.type} (${update.date}):\n${text}\n\nRead more: ${update.link}\n\n#BigQuery #GCP`;
    }

    // Update character counters and the visual SVG ring
    function updateCharCounter() {
        const text = tweetTextarea.value;
        const currentLen = text.length;
        const remaining = TWITTER_CHAR_LIMIT - currentLen;

        charCountNum.textContent = remaining;

        // Visual progress circle
        const ratio = Math.min(currentLen / TWITTER_CHAR_LIMIT, 1);
        const offset = RING_CIRCUMFERENCE - (ratio * RING_CIRCUMFERENCE);
        charRingProgress.style.strokeDashoffset = offset;

        // Change color based on length warning levels
        charCountNum.className = 'char-count-text';
        charRingProgress.style.stroke = 'var(--border-active)'; // default cyan

        if (remaining <= 40 && remaining > 0) {
            charCountNum.classList.add('warning');
            charRingProgress.style.stroke = 'var(--color-change)'; // amber
        } else if (remaining <= 0) {
            charCountNum.classList.add('danger');
            charRingProgress.style.stroke = 'var(--color-deprecation)'; // red
        }
    }

    // Sync live preview panel
    function updateLivePreview() {
        const text = tweetTextarea.value;
        if (text.trim() === '') {
            tweetLivePreview.textContent = 'Draft content is empty. Type in the text box above to preview your tweet.';
            tweetLivePreview.style.color = 'var(--text-muted)';
        } else {
            tweetLivePreview.textContent = text;
            tweetLivePreview.style.color = 'var(--text-primary)';
        }
    }

    // Find and re-apply selection after refresh
    function findAndReselectUpdate() {
        if (!selectedUpdate) return;
        const element = document.getElementById(selectedUpdate.id);
        if (element) {
            element.classList.add('selected');
        } else {
            // If the element doesn't exist by ID (e.g. indices changed), try matching content
            const allCards = feedContentArea.querySelectorAll('.update-card');
            for (let card of allCards) {
                if (card.dataset.date === selectedUpdate.date && 
                    card.dataset.type === selectedUpdate.type &&
                    card.querySelector('.card-body').innerText === selectedUpdate.text) {
                    card.classList.add('selected');
                    selectedUpdate.id = card.id; // update ID in state
                    break;
                }
            }
        }
    }

    // Toast notification creator
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let iconSvg = '';
        if (type === 'success') {
            iconSvg = `<svg class="toast-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        } else if (type === 'warning') {
            iconSvg = `<svg class="toast-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
        } else if (type === 'error') {
            iconSvg = `<svg class="toast-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        } else {
            iconSvg = `<svg class="toast-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        }

        toast.innerHTML = `
            ${iconSvg}
            <span>${message}</span>
        `;
        
        toastContainer.appendChild(toast);

        // Remove toast after 3.5s
        setTimeout(() => {
            toast.style.animation = 'fade-out 0.3s forwards';
            toast.addEventListener('animationend', () => {
                toast.remove();
            });
        }, 3500);
    }

    // Export current visible/filtered release notes to CSV
    function exportToCSV() {
        const csvRows = [['Date', 'Type', 'Description', 'Link']];
        
        releaseNotes.forEach(entry => {
            const matchedUpdates = entry.updates.filter(upd => {
                const matchesType = (activeTypeFilter === 'all' || upd.type === activeTypeFilter);
                const matchesSearch = !searchQuery || 
                    upd.type.toLowerCase().includes(searchQuery) ||
                    upd.text.toLowerCase().includes(searchQuery) ||
                    entry.title.toLowerCase().includes(searchQuery);
                return matchesType && matchesSearch;
            });
            
            matchedUpdates.forEach(upd => {
                const escapeCsv = (val) => {
                    if (val === null || val === undefined) return '';
                    let str = String(val).replace(/"/g, '""'); // Escape double quotes
                    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
                        str = `"${str}"`;
                    }
                    return str;
                };
                
                csvRows.push([
                    escapeCsv(entry.title),
                    escapeCsv(upd.type),
                    escapeCsv(upd.text),
                    escapeCsv(entry.link)
                ]);
            });
        });
        
        if (csvRows.length <= 1) {
            showToast('No updates to export!', 'warning');
            return;
        }
        
        const csvContent = csvRows.map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `bigquery_release_notes_${activeTypeFilter}_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast(`Exported ${csvRows.length - 1} updates to CSV!`, 'success');
    }

    // Helper to apply the active theme and toggle icons
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        if (!themeToggleBtn) return;
        
        const sunIcon = themeToggleBtn.querySelector('.theme-icon-sun');
        const moonIcon = themeToggleBtn.querySelector('.theme-icon-moon');
        
        if (theme === 'light') {
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
        } else {
            sunIcon.classList.remove('hidden');
            moonIcon.classList.add('hidden');
        }
    }
});
