document.addEventListener('DOMContentLoaded', function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        var currentTab = tabs[0];
        var actionButton = document.getElementById('actionButton');
        var downloadCsvButton = document.getElementById('downloadCsvButton');
        var downloadJsonButton = document.getElementById('downloadJsonButton');
        var resultsTable = document.getElementById('resultsTable');
        var filenameInput = document.getElementById('filenameInput');
        var progressContainer = document.getElementById('progressContainer');
        var progressFill = document.getElementById('progressFill');
        var progressText = document.getElementById('progressText');
        var statsContainer = document.getElementById('statsContainer');

        if (currentTab && currentTab.url.includes('://www.google.com/maps/search')) {
            document.getElementById('message').textContent = 'Listo para scrapear Google Maps';
            actionButton.disabled = false;
            actionButton.classList.add('enabled');
        } else {
            var messageElement = document.getElementById('message');
            messageElement.innerHTML = '';
            var linkElement = document.createElement('a');
            linkElement.href = 'https://www.google.com/maps/search/';
            linkElement.textContent = 'Abrí una búsqueda de Google Maps primero.';
            linkElement.target = '_blank';
            messageElement.appendChild(linkElement);

            actionButton.style.display = 'none';
            downloadCsvButton.style.display = 'none';
            downloadJsonButton.style.display = 'none';
            filenameInput.style.display = 'none';
        }

        actionButton.addEventListener('click', function () {
            progressContainer.style.display = 'block';
            statsContainer.style.display = 'block';
            actionButton.disabled = true;
            actionButton.textContent = 'Scrapeando...';

            var progress = 0;
            var progressInterval = setInterval(function () {
                progress += Math.random() * 8;
                if (progress > 92) progress = 92;
                progressFill.style.width = progress + '%';
                progressText.textContent = 'Extrayendo leads... ' + Math.round(progress) + '%';
            }, 300);

            chrome.scripting.executeScript(
                {
                    target: { tabId: currentTab.id },
                    function: scrapeData
                },
                function (results) {
                    clearInterval(progressInterval);
                    progressFill.style.width = '100%';
                    progressText.textContent = '¡Completado!';

                    actionButton.disabled = false;
                    actionButton.textContent = 'Scrape Google Maps';

                    while (resultsTable.firstChild) {
                        resultsTable.removeChild(resultsTable.firstChild);
                    }

                    const headers = [
                        'Title',
                        'Rating',
                        'Reviews',
                        'Phone',
                        'WhatsApp',
                        'Email',
                        'Industry',
                        'Address',
                        'Maps Address Link',
                        'Website',
                        'Social Media',
                        'Hours',
                        'Lead Score',
                        'Google Maps Link'
                    ];

                    const headerRow = document.createElement('tr');
                    headers.forEach(function (headerText) {
                        const header = document.createElement('th');
                        header.textContent = headerText;
                        headerRow.appendChild(header);
                    });
                    resultsTable.appendChild(headerRow);

                    if (!results || !results[0] || !results[0].result) return;

                    var data = results[0].result;

                    var totalLeads = data.length;
                    var withPhone = data.filter(item => item.phone).length;
                    var withEmail = data.filter(item => item.email).length;
                    var withWeb = data.filter(item => item.companyUrl).length;
                    var withSocial = data.filter(item => item.socialMedia).length;
                    var highValueLeads = data.filter(item => item.leadScore >= 8).length;
                    var ratings = data.filter(item => item.rating && item.rating !== '0').map(item => parseFloat(item.rating));
                    var avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '0';

                    document.getElementById('totalLeads').textContent = totalLeads;
                    document.getElementById('withPhone').textContent = withPhone;
                    document.getElementById('withEmail').textContent = withEmail;
                    document.getElementById('withWeb').textContent = withWeb;
                    document.getElementById('withSocial').textContent = withSocial;
                    document.getElementById('highValueLeads').textContent = highValueLeads;
                    document.getElementById('avgRating').textContent = avgRating;

                    data.forEach(function (item) {
                        var row = document.createElement('tr');
                        [
                            'title',
                            'rating',
                            'reviewCount',
                            'phone',
                            'whatsAppPhone',
                            'email',
                            'industry',
                            'address',
                            'mapsAddressLink',
                            'companyUrl',
                            'socialMedia',
                            'hours',
                            'leadScore',
                            'href'
                        ].forEach(function (key) {
                            var cell = document.createElement('td');
                            if (key === 'leadScore') {
                                if (item[key] >= 8) cell.className = 'lead-high';
                                else if (item[key] >= 6) cell.className = 'lead-medium';
                                else if (item[key] < 4) cell.className = 'lead-low';
                            }

                            if (key === 'title' && item.phone && item.email && item.companyUrl) {
                                row.style.borderLeft = '4px solid #28a745';
                            }

                            cell.textContent = item[key] || '';
                            row.appendChild(cell);
                        });
                        resultsTable.appendChild(row);
                    });

                    if (data.length > 0) {
                        downloadCsvButton.disabled = false;
                        downloadJsonButton.disabled = false;
                    }
                }
            );
        });

        downloadCsvButton.addEventListener('click', function () {
            var csv = tableToCsv(resultsTable);
            var filename = sanitizeFilename(filenameInput.value.trim(), 'csv');
            downloadToFolder(csv, filename, 'text/csv', 'GoogleMapsLeads');
        });

        downloadJsonButton.addEventListener('click', function () {
            var json = tableToJson(resultsTable);
            var filename = sanitizeFilename(filenameInput.value.trim(), 'json');
            downloadToFolder(json, filename, 'application/json', 'GoogleMapsLeads');
        });
    });
});

async function scrapeData() {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const leftPanel = document.querySelector('div[role="feed"]') || document.querySelector('[aria-label*="Results for"]') || document.querySelector('[aria-label*="Resultados de"]');

    async function autoScrollResults() {
        if (!leftPanel) return;

        let stableIterations = 0;
        let previousCount = 0;

        for (let i = 0; i < 60; i++) {
            const cards = getResultCards();
            leftPanel.scrollTo(0, leftPanel.scrollHeight);
            await sleep(800);

            const currentCount = cards.length;
            if (currentCount === previousCount) {
                stableIterations++;
            } else {
                stableIterations = 0;
                previousCount = currentCount;
            }

            const endText = leftPanel.innerText || '';
            if (stableIterations >= 4 || /You've reached the end of the list|Llegaste al final de la lista/i.test(endText)) {
                break;
            }
        }
    }

    function getResultCards() {
        return Array.from(document.querySelectorAll('a[href*="/maps/place/"]'))
            .map(a => a.closest('[role="article"]') || a.closest('[jsaction*="mouseover:pane"]') || a.parentElement)
            .filter(Boolean);
    }

    function cleanText(value) {
        return (value || '').replace(/\s+/g, ' ').trim();
    }

    function normalizeForCompare(value) {
        return cleanText(value)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, '');
    }

    function areSimilarTitles(a, b) {
        const left = normalizeForCompare(a);
        const right = normalizeForCompare(b);
        if (!left || !right) return false;
        if (left === right) return true;
        return left.includes(right) || right.includes(left);
    }

    function normalizePhone(value) {
        const digits = (value || '').replace(/\D/g, '');
        if (!digits) return '';

        if (digits.startsWith('54') && digits.length >= 12) return '+' + digits;
        if (digits.startsWith('0')) return '+54' + digits.slice(1);
        if (digits.length >= 10 && digits.length <= 11) return '+54' + digits;
        if (digits.length >= 8) return '+' + digits;
        return '';
    }

    function toWhatsAppLink(value) {
        const digits = normalizePhone(value).replace(/\D/g, '');
        return digits ? `https://wa.me/${digits}` : '';
    }

    function isLikelyPhoneCandidate(raw) {
        const value = cleanText(raw);
        if (!value) return false;

        const digits = value.replace(/\D/g, '');
        if (digits.length < 8 || digits.length > 15) return false;

        // Evita códigos postales o numeraciones cortas de calle
        if (/^\d{4,6}$/.test(digits)) return false;

        return /\+|\(|\)|-|\s/.test(value) || digits.length >= 10;
    }

    function extractPhoneCandidatesFromText(text) {
        const rawMatches = cleanText(text).match(/(\+?\d[\d\s\-()]{7,}\d)/g) || [];
        return rawMatches.filter(isLikelyPhoneCandidate);
    }

    function uniquePhones(values) {
        const seen = new Set();
        const result = [];

        values.forEach(function (value) {
            const normalized = normalizePhone(value);
            if (!normalized) return;
            if (seen.has(normalized)) return;
            seen.add(normalized);
            result.push(value);
        });

        return result;
    }

    function pickBestPhone(candidates) {
        const uniques = uniquePhones(candidates);
        if (!uniques.length) return '';

        uniques.sort(function (a, b) {
            const aDigits = a.replace(/\D/g, '').length;
            const bDigits = b.replace(/\D/g, '').length;
            return bDigits - aDigits;
        });

        return uniques[0];
    }

    function extractEmails(text) {
        const matches = (text || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
        return [...new Set(matches.map(m => m.toLowerCase()))].join(', ');
    }

    function extractSocialLinks(scope) {
        const socialDomains = ['instagram.com', 'facebook.com', 'linkedin.com', 'x.com', 'twitter.com', 'tiktok.com', 'youtube.com'];
        const links = Array.from(scope.querySelectorAll('a[href]'))
            .map(a => a.href)
            .filter(href => socialDomains.some(domain => href.includes(domain)));
        return [...new Set(links)].join(', ');
    }

    function extractWebsite(scope) {
        const links = Array.from(scope.querySelectorAll('a[href]')).map(a => a.href);
        const external = links.find(href => href.startsWith('http') && !href.includes('google.com/maps') && !href.includes('/maps/place/'));
        return external || '';
    }

    function extractAddressAndMapsLink(detailScope, fallbackMapsUrl) {
        let address = '';

        const addressButton = detailScope.querySelector('button[data-item-id="address"], button[aria-label*="Address"], button[aria-label*="Dirección"]');
        if (addressButton) {
            address = cleanText(addressButton.textContent);
        }

        if (!address) {
            const txt = cleanText(detailScope.innerText);
            const addressMatch = txt.match(/\d+[\w\s,.-]{8,}/);
            address = addressMatch ? cleanText(addressMatch[0]) : '';
        }
    }

        const mapsAddressLink = address
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
            : fallbackMapsUrl || '';

        return { address, mapsAddressLink };
    }

    function parseCardQuickInfo(card) {
        const title = cleanText(card.querySelector('.fontHeadlineSmall')?.textContent || card.querySelector('h3')?.textContent || '');
        const ratingAria = card.querySelector('[role="img"]')?.getAttribute('aria-label') || '';
        const ratingMatch = ratingAria.match(/([0-9]+[\.,]?[0-9]*)/);
        const reviewsMatch = ratingAria.match(/([0-9.,]+)\s*(reviews|reseñas|reseña)/i);

        const phoneCandidates = extractPhoneCandidatesFromText(card.innerText || '');
        const phoneCandidate = pickBestPhone(phoneCandidates);
        const industry = cleanText(card.innerText.split('·')[1] || '');

        return {
            title,
            rating: ratingMatch ? ratingMatch[1].replace(',', '.') : '0',
            reviewCount: reviewsMatch ? reviewsMatch[1].replace(/\./g, '') : '0',
            phone: phoneCandidate,
            industry
        };
    }

    async function openCardAndExtract(card, fallback) {
        const link = card.querySelector('a[href*="/maps/place/"]');
        const href = link ? link.href : '';

        card.scrollIntoView({ behavior: 'instant', block: 'center' });
        if (link) {
            link.click();
        } else {
            card.click();
        }

        await sleep(500);

        async function waitForDetailReady(expectedTitle) {
            for (let i = 0; i < 10; i++) {
                const titleEl = document.querySelector('h1.fontHeadlineLarge, h1.DUwDvf, h1');
                const detailTitle = cleanText(titleEl?.textContent || '');
                if (areSimilarTitles(detailTitle, expectedTitle)) {
                    return true;
                }
                await sleep(250);
            }
            return false;
        }

        const detailReady = await waitForDetailReady(fallback.title);

        const detailScope = document.querySelector('div[role="main"]') || document.body;
        const detailText = cleanText(detailScope.innerText);

        const phoneCandidates = [];

        // 1) Fuentes confiables dentro del detalle
        if (detailReady) {
            const phoneButtons = detailScope.querySelectorAll('button[data-item-id*="phone"], button[aria-label*="Phone"], button[aria-label*="Teléfono"], a[href^="tel:"]');
            phoneButtons.forEach(function (el) {
                const textValue = cleanText(el.textContent || '');
                if (isLikelyPhoneCandidate(textValue)) phoneCandidates.push(textValue);

                const hrefValue = cleanText(el.getAttribute && el.getAttribute('href'));
                if (hrefValue && hrefValue.startsWith('tel:')) {
                    const telValue = hrefValue.replace('tel:', '').trim();
                    if (isLikelyPhoneCandidate(telValue)) phoneCandidates.push(telValue);
                }
            });

            // 2) Regex limitada a líneas con etiqueta telefónica (evita números repetidos globales)
            const phoneLines = (detailScope.innerText || '')
                .split('\n')
                .filter(line => /tel|phone|llamar/i.test(line));

            phoneLines.forEach(function (line) {
                phoneCandidates.push(...extractPhoneCandidatesFromText(line));
            });
        }

        // 3) Fallback por tarjeta de resultado (suele ser el teléfono correcto del negocio)
        if (fallback.phone) {
            phoneCandidates.push(fallback.phone);
        }

        const phone = pickBestPhone(phoneCandidates);

        const email = extractEmails(detailText);
        const companyUrl = extractWebsite(detailScope);
        const socialMedia = extractSocialLinks(detailScope);

        const hoursButton = detailScope.querySelector('button[data-item-id*="oh"], div[aria-label*="Hours"], div[aria-label*="Horario"]');
        const hours = cleanText(hoursButton?.textContent || '');

        const { address, mapsAddressLink } = extractAddressAndMapsLink(detailScope, href);

        let leadScore = 0;
        if (phone) leadScore += 3;
        if (email) leadScore += 3;
        if (companyUrl) leadScore += 2;
        if (socialMedia) leadScore += 1;
        if (parseFloat(fallback.rating || '0') >= 4) leadScore += 1;
        if (parseInt((fallback.reviewCount || '0').toString().replace(/\D/g, ''), 10) >= 50) leadScore += 1;

        return {
            title: fallback.title,
            rating: fallback.rating,
            reviewCount: fallback.reviewCount,
            phone: normalizePhone(phone),
            whatsAppPhone: toWhatsAppLink(phone),
            email,
            industry: fallback.industry,
            address,
            mapsAddressLink,
            companyUrl,
            socialMedia,
            hours,
            leadScore,
            href
        };
    }

    await autoScrollResults();

    const cards = getResultCards();
    const results = [];
    const seen = new Set();

    for (let i = 0; i < cards.length; i++) {
        const fallback = parseCardQuickInfo(cards[i]);
        const lead = await openCardAndExtract(cards[i], fallback);
        const dedupeKey = (lead.title + '|' + lead.address).toLowerCase();

        if (!seen.has(dedupeKey)) {
            seen.add(dedupeKey);
            results.push(lead);
        }
    }

    results.sort((a, b) => b.leadScore - a.leadScore);
    return results;
}

function sanitizeFilename(filename, ext) {
    if (!filename) {
        var date = new Date();
        var dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
        var timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '');
        return 'google-maps-leads_' + dateStr + '_' + timeStr + '.' + ext;
    }
    return filename.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.' + ext;
}

function tableToCsv(table) {
    var csv = [];
    var rows = table.querySelectorAll('tr');
    for (var i = 0; i < rows.length; i++) {
        var row = [];
        var cols = rows[i].querySelectorAll('td, th');
        for (var j = 0; j < cols.length; j++) {
            row.push('"' + cols[j].innerText.replace(/"/g, '""') + '"');
        }
        csv.push(row.join(','));
    }
    return csv.join('\n');
}

function tableToJson(table) {
    var data = [];
    var rows = table.querySelectorAll('tr');
    var headers = [];

    if (rows.length > 0) {
        var headerCells = rows[0].querySelectorAll('th');
        for (var i = 0; i < headerCells.length; i++) {
            headers.push(headerCells[i].textContent.trim());
        }
    }

    for (var r = 1; r < rows.length; r++) {
        var row = {};
        var cells = rows[r].querySelectorAll('td');
        for (var c = 0; c < cells.length && c < headers.length; c++) {
            var header = headers[c].toLowerCase().replace(/\s+/g, '');
            row[header] = cells[c].textContent.trim();
        }
        data.push(row);
    }

    return JSON.stringify(data, null, 2);
}

function downloadToFolder(content, filename, mimeType, folderName) {
    var date = new Date();
    var dateFolder = date.toISOString().split('T')[0];
    var folderPath = folderName + '/' + dateFolder + '/' + filename;

    var blob = new Blob([content], { type: mimeType });
    var blobUrl = URL.createObjectURL(blob);

    chrome.downloads.download(
        {
            url: blobUrl,
            filename: folderPath,
            saveAs: false
        },
        function () {
            if (chrome.runtime.lastError) {
                downloadFileFallback(content, filename, mimeType);
            } else {
                setTimeout(function () {
                    URL.revokeObjectURL(blobUrl);
                }, 1000);
                showNotification('✅ Archivo guardado en: Descargas/' + folderPath);
            }
        }
    );
}

function downloadFileFallback(content, filename, mimeType) {
    var file = new Blob([content], { type: mimeType });
    var downloadLink = document.createElement('a');
    downloadLink.download = filename;
    downloadLink.href = URL.createObjectURL(file);
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    showNotification('Archivo descargado: ' + filename);
}

function showNotification(message) {
    var notification = document.createElement('div');
    notification.style.cssText = 'position: fixed; top: 10px; right: 10px; background: #28a745; color: white; padding: 12px 20px; border-radius: 8px; z-index: 10000; box-shadow: 0 4px 6px rgba(0,0,0,0.1);';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(function () {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s';
        setTimeout(function () {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}
