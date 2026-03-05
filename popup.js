document.addEventListener('DOMContentLoaded', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
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

        if (currentTab && currentTab.url.includes("://www.google.com/maps/search")) {
            document.getElementById('message').textContent = "Let's scrape Google Maps!";
            actionButton.disabled = false;
            actionButton.classList.add('enabled');
        } else {
            var messageElement = document.getElementById('message');
            messageElement.innerHTML = '';
            var linkElement = document.createElement('a');
            linkElement.href = 'https://www.google.com/maps/search/';
            linkElement.textContent = "Go to Google Maps Search.";
            linkElement.target = '_blank'; 
            messageElement.appendChild(linkElement);

            actionButton.style.display = 'none'; 
            downloadCsvButton.style.display = 'none';
            downloadJsonButton.style.display = 'none';
            filenameInput.style.display = 'none'; 
        }

        actionButton.addEventListener('click', function() {
            // Show progress indicators
            progressContainer.style.display = 'block';
            statsContainer.style.display = 'block';
            actionButton.disabled = true;
            actionButton.textContent = 'Scraping...';
            
            // Start progress animation
            var progress = 0;
            var progressInterval = setInterval(function() {
                progress += Math.random() * 10;
                if (progress > 90) progress = 90;
                progressFill.style.width = progress + '%';
                progressText.textContent = 'Extrayendo leads... ' + Math.round(progress) + '%';
            }, 200);

            chrome.scripting.executeScript({
                target: {tabId: currentTab.id},
                function: scrapeData
            }, function(results) {
                // Complete progress
                clearInterval(progressInterval);
                progressFill.style.width = '100%';
                progressText.textContent = '¡Completado!';
                
                // Reset button
                actionButton.disabled = false;
                actionButton.textContent = 'Scrape Google Maps';
                while (resultsTable.firstChild) {
                    resultsTable.removeChild(resultsTable.firstChild);
                }

                // Define and add headers to the table
                const headers = ['Title', 'Rating', 'Reviews', 'Phone', 'Email', 'Industry', 'Address', 'Website', 'Hours', 'Social Media', 'Lead Score', 'Google Maps Link'];
                const headerRow = document.createElement('tr');
                headers.forEach(headerText => {
                    const header = document.createElement('th');
                    header.textContent = headerText;
                    headerRow.appendChild(header);
                });
                resultsTable.appendChild(headerRow);

                // Add new results to the table
                if (!results || !results[0] || !results[0].result) return;
                
                // Calculate lead statistics
                var totalLeads = results[0].result.length;
                var withPhone = results[0].result.filter(item => item.phone).length;
                var withEmail = results[0].result.filter(item => item.email).length;
                var withWeb = results[0].result.filter(item => item.companyUrl).length;
                var withSocial = results[0].result.filter(item => item.socialMedia).length;
                var highValueLeads = results[0].result.filter(item => item.leadScore >= 8).length;
                
                // Calculate average rating
                var ratings = results[0].result.filter(item => item.rating && item.rating !== '0').map(item => parseFloat(item.rating));
                var avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '0';
                
                // Update statistics display
                document.getElementById('totalLeads').textContent = totalLeads;
                document.getElementById('withPhone').textContent = withPhone;
                document.getElementById('withEmail').textContent = withEmail;
                document.getElementById('withWeb').textContent = withWeb;
                document.getElementById('withSocial').textContent = withSocial;
                document.getElementById('highValueLeads').textContent = highValueLeads;
                document.getElementById('avgRating').textContent = avgRating;
                
                results[0].result.forEach(function(item) {
                    var row = document.createElement('tr');
                    ['title', 'rating', 'reviewCount', 'phone', 'email', 'industry', 'address', 'companyUrl', 'hours', 'socialMedia', 'leadScore', 'href'].forEach(function(key) {
                        var cell = document.createElement('td');
                        
                        if (key === 'reviewCount' && item[key]) {
                            item[key] = item[key].replace(/\(|\)/g, ''); 
                        }
                        
                        // Highlight high-value leads
                        if (key === 'leadScore') {
                            if (item[key] >= 8) {
                                cell.className = 'lead-high';
                            } else if (item[key] >= 6) {
                                cell.className = 'lead-medium';
                            } else if (item[key] < 4) {
                                cell.className = 'lead-low';
                            }
                        }
                        
                        // Highlight rows with complete contact info
                        if (key === 'title' && item.phone && item.email && item.companyUrl) {
                            row.style.borderLeft = '4px solid #28a745';
                        }
                        
                        cell.textContent = item[key] || ''; 
                        row.appendChild(cell);
                    });
                    resultsTable.appendChild(row);
                });

                if (results && results[0] && results[0].result && results[0].result.length > 0) {
                    downloadCsvButton.disabled = false;
                    downloadJsonButton.disabled = false;
                }
            });
        });

        downloadCsvButton.addEventListener('click', function() {
            var csv = tableToCsv(resultsTable); 
            var filename = filenameInput.value.trim();
            if (!filename) {
                var date = new Date();
                var dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
                var timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '');
                filename = 'google-maps-leads_' + dateStr + '_' + timeStr + '.csv'; 
            } else {
                filename = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.csv';
            }
            downloadToFolder(csv, filename, 'text/csv', 'GoogleMapsLeads'); 
        });

        downloadJsonButton.addEventListener('click', function() {
            var json = tableToJson(resultsTable);
            var filename = filenameInput.value.trim();
            if (!filename) {
                var date = new Date();
                var dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
                var timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '');
                filename = 'google-maps-leads_' + dateStr + '_' + timeStr + '.json'; 
            } else {
                filename = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.json';
            }
            downloadToFolder(json, filename, 'application/json', 'GoogleMapsLeads');
        });

    });
});


/**
 * COMPREHENSIVE GOOGLE MAPS DATA SCRAPING FUNCTION
 * 
 * This function extracts ALL available information from Google Maps search results.
 * It uses multiple extraction methods to capture complete data:
 * 
 * 1. Structured Data: Uses Google Maps specific selectors (data-value, data-item-id, etc.)
 * 2. DOM Elements: Searches in specific elements (buttons, links, aria-labels)
 * 3. Text Content: Comprehensive regex patterns for phone, email, address
 * 4. Multiple Fallbacks: If one method fails, tries alternative approaches
 * 
 * EXTRACTION METHODS:
 * - Phone: tel: links, data-value attributes, button text, comprehensive regex
 * - Email: mailto: links, data attributes, encoded emails, text search
 * - Address: Address elements, location data, text patterns
 * - All other fields: Multiple selectors and fallbacks
 */
function scrapeData() {
    var links = Array.from(document.querySelectorAll('a[href^="https://www.google.com/maps/place"]'));
    return links.map(link => {
        // Find container using multiple selectors for maximum compatibility
        var container = link.closest('[jsaction*="mouseover:pane"]');
        
        // Try multiple container selectors for better compatibility
        if (!container) {
            container = link.closest('[data-value]') || link.parentElement;
        }
        
        // Expand search to parent containers if needed
        if (!container) {
            var parent = link.parentElement;
            while (parent && parent !== document.body) {
                if (parent.querySelectorAll('a[href^="https://www.google.com/maps/place"]').length === 1) {
                    container = parent;
                    break;
                }
                parent = parent.parentElement;
            }
        }
        
        var titleText = '';
        var rating = '';
        var reviewCount = '';
        var phone = '';
        var email = '';
        var industry = '';
        var address = '';
        var companyUrl = '';
        var hours = '';
        var socialMedia = '';
        var leadScore = 0;
        
        // Extract title using multiple selectors
        if (container) {
            var titleEl = container.querySelector('.fontHeadlineSmall');
            titleText = titleEl ? titleEl.textContent : '';
            if (!titleText) {
                var dataEl = container.querySelector('[data-value]');
                titleText = dataEl ? dataEl.getAttribute('data-value') : '';
            }
            if (!titleText) {
                var h3El = container.querySelector('h3');
                titleText = h3El ? h3El.textContent : '';
            }
            if (!titleText) {
                titleText = link.textContent ? link.textContent.trim() : '';
            }
        }

        // Rating and Reviews
        if (container) {
            var roleImgContainer = container.querySelector('[role="img"]');
            
            if (roleImgContainer) {
                var ariaLabel = roleImgContainer.getAttribute('aria-label');
            
                if (ariaLabel && ariaLabel.includes("stars")) {
                    var parts = ariaLabel.split(' ');
                    var rating = parts[0];
                    var reviewCount = '(' + parts[2] + ')'; 
                } else {
                    rating = '0';
                    reviewCount = '0';
                }
            }
        }

        // Address and Industry - Improved extraction
        if (container) {
            var containerText = container.textContent || '';
            
            // Look for address in specific elements first
            var addressElements = container.querySelectorAll('[data-value*="address"], [data-value*="location"], .address, .location, [class*="address"], [class*="location"]');
            var addressTexts = [];
            
            addressElements.forEach(el => {
                var text = el.textContent || el.getAttribute('data-value') || '';
                if (text && text.length > 10) {
                    addressTexts.push(text);
                }
            });
            
            // Address regex patterns
            var addressPatterns = [
                /\d+ [\w\s]+(?:#\s*\d+|Suite\s*\d+|Apt\s*\d+)?/,
                /\d+[\s\w]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Place|Pl)/i
            ];
            
            var foundAddress = '';
            
            // First check specific address elements
            for (var i = 0; i < addressTexts.length; i++) {
                for (var j = 0; j < addressPatterns.length; j++) {
                    var match = addressTexts[i].match(addressPatterns[j]);
                    if (match) {
                        foundAddress = match[0];
                        break;
                    }
                }
                if (foundAddress) break;
            }
            
            // If not found in specific elements, search in container text
            if (!foundAddress) {
                for (var i = 0; i < addressPatterns.length; i++) {
                    var match = containerText.match(addressPatterns[i]);
                    if (match) {
                        foundAddress = match[0];
                        break;
                    }
                }
            }
            
            if (foundAddress) {
                address = foundAddress;
                
                // Clean address
                var filterRegex = /\b(Closed|Open 24 hours|24 hours|Open|Abre|Cierra)\b/g;
                address = address.replace(filterRegex, '').trim();
                address = address.replace(/(\d+)(Open|Abre)/g, '$1').trim();
                address = address.replace(/(\w)(Open|Abre)/g, '$1').trim();
                address = address.replace(/(\w)(Closed|Cierra)/g, '$1').trim();
                
                // Extract industry more carefully
                var textBeforeAddress = containerText.substring(0, containerText.indexOf(foundAddress)).trim();
                var ratingIndex = textBeforeAddress.lastIndexOf(rating + reviewCount);
                
                if (ratingIndex !== -1) {
                    var rawIndustryText = textBeforeAddress.substring(ratingIndex + (rating + reviewCount).length).trim();
                    
                    // Split by common separators and take the first meaningful part
                    var industryParts = rawIndustryText.split(/[\r\n•·]/);
                    var cleanIndustry = industryParts[0].replace(/[.,#!?]/g, '').trim();
                    
                    // Filter out common non-industry words
                    var nonIndustryWords = ['Open', 'Closed', 'Abre', 'Cierra', 'Hours', 'Horarios', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                    var isIndustry = true;
                    
                    for (var k = 0; k < nonIndustryWords.length; k++) {
                        if (cleanIndustry.toLowerCase().includes(nonIndustryWords[k].toLowerCase())) {
                            isIndustry = false;
                            break;
                        }
                    }
                    
                    if (isIndustry && cleanIndustry.length > 2 && cleanIndustry.length < 50) {
                        industry = cleanIndustry;
                    }
                }
            } else {
                address = '';
            }
        }

        // Company URL
        if (container) {
            var allLinks = Array.from(container.querySelectorAll('a[href]'));
            var filteredLinks = allLinks.filter(a => !a.href.startsWith("https://www.google.com/maps/place/"));
            if (filteredLinks.length > 0) {
                companyUrl = filteredLinks[0].href;
            }
        }

        // Phone Numbers - Extract from Google Maps structured data
        if (container) {
            var phoneNumbers = [];
            
            // Method 1: Look for phone links (tel:)
            var telLinks = container.querySelectorAll('a[href^="tel:"]');
            telLinks.forEach(function(link) {
                var telValue = link.getAttribute('href').replace('tel:', '').trim();
                if (telValue && telValue.length >= 8) {
                    phoneNumbers.push(telValue);
                }
                // Also check the link text which might have formatted number
                var linkText = link.textContent.trim();
                if (linkText && linkText.length >= 8) {
                    phoneNumbers.push(linkText);
                }
            });
            
            // Method 2: Look for data-value attributes with phone data
            var dataElements = container.querySelectorAll('[data-value]');
            dataElements.forEach(function(el) {
                var dataValue = el.getAttribute('data-value');
                if (dataValue) {
                    // Check if it looks like a phone number
                    var digitsOnly = dataValue.replace(/\D/g, '');
                    if (digitsOnly.length >= 8 && digitsOnly.length <= 15) {
                        // More validation - check if it has phone-like structure
                        if (dataValue.match(/[\d\s\+\-\(\)]{8,}/)) {
                            phoneNumbers.push(dataValue.trim());
                        }
                    }
                }
            });
            
            // Method 3: Look for elements with phone-related classes or attributes
            var phoneElements = container.querySelectorAll('[data-item-id*="phone"], [data-item-id*="tel"], [class*="phone"], [class*="tel"], [aria-label*="phone"], [aria-label*="tel"]');
            phoneElements.forEach(function(el) {
                var phoneText = el.textContent || el.getAttribute('aria-label') || el.getAttribute('data-value') || '';
                if (phoneText) {
                    phoneNumbers.push(phoneText.trim());
                }
            });
            
            // Method 4: Search in all button and clickable elements (Google Maps often uses buttons for phone)
            var clickableElements = container.querySelectorAll('button, [role="button"], [jsaction]');
            clickableElements.forEach(function(el) {
                var elText = el.textContent || '';
                // Check for phone patterns in button text
                var phonePattern = /(\+?\d{1,4}[\s\-\(\)]?)?(\d{2,4}[\s\-]?\d{3,4}[\s\-]?\d{3,4})/g;
                var matches = elText.match(phonePattern);
                if (matches) {
                    matches.forEach(function(match) {
                        var digits = match.replace(/\D/g, '');
                        if (digits.length >= 8 && digits.length <= 15) {
                            phoneNumbers.push(match.trim());
                        }
                    });
                }
            });
            
            // Method 5: Comprehensive text search with better patterns
            var containerText = container.innerText || container.textContent || '';
            if (containerText) {
                // More comprehensive phone patterns
                var phonePatterns = [
                    // Argentine formats: 011 1234-5678, (011) 1234-5678, +54 11 1234-5678
                    /(\+54\s?)?(\(?0?11\)?|\(?0?2\d{2}\)?|\(?0?3\d{2}\)?)[\s\-]?\d{3,4}[\s\-]?\d{3,4}/g,
                    // Mobile: 15 1234-5678, 15-1234-5678
                    /15[\s\-]?\d{4}[\s\-]?\d{4}/g,
                    // Landline with area code: 02323-42-1234, 02323 42-1234
                    /0\d{3,4}[\s\-]?\d{2,3}[\s\-]?\d{4}/g,
                    // International: +1 (555) 123-4567
                    /(\+\d{1,3}\s?)?\(?\d{1,4}\)?[\s\-\.]?\d{3,4}[\s\-\.]?\d{3,4}/g,
                    // Generic: any sequence with phone-like structure
                    /\b(\+?\d{1,4}[\s\-\(\)]?)?(\d{2,4}[\s\-]?\d{3,4}[\s\-]?\d{3,4})\b/g
                ];
                
                phonePatterns.forEach(function(pattern) {
                    var matches = containerText.match(pattern);
                    if (matches) {
                        matches.forEach(function(match) {
                            var digits = match.replace(/\D/g, '');
                            // Validate length and structure
                            if (digits.length >= 8 && digits.length <= 15) {
                                // Avoid addresses (numbers too short or in wrong format)
                                if (!match.match(/^\d{4,5}\s\d{1,2}$/)) {
                                    phoneNumbers.push(match.trim());
                                }
                            }
                        });
                    }
                });
            }
            
            // Clean and deduplicate phone numbers
            if (phoneNumbers.length > 0) {
                var uniquePhones = [];
                var seenDigits = [];
                
                phoneNumbers.forEach(function(p) {
                    var cleaned = p.replace(/[^\d\+\-\(\)\s]/g, '').trim();
                    var digitsOnly = cleaned.replace(/\D/g, '');
                    
                    // Check if we've seen this number before (by digits)
                    var isDuplicate = seenDigits.indexOf(digitsOnly) !== -1;
                    
                    // Validate: must be 8-15 digits and not look like an address
                    if (!isDuplicate && 
                        digitsOnly.length >= 8 && 
                        digitsOnly.length <= 15 &&
                        !cleaned.match(/^\d{4,5}\s\d{1,2}$/) && // Not "02323 20"
                        !cleaned.match(/^\d{5,7}$/)) { // Not just numbers
                        
                        uniquePhones.push(cleaned);
                        seenDigits.push(digitsOnly);
                    }
                });
                
                // Take the longest/most complete phone number if multiple found
                if (uniquePhones.length > 0) {
                    // Sort by length (longer usually means more complete)
                    uniquePhones.sort(function(a, b) {
                        return b.replace(/\D/g, '').length - a.replace(/\D/g, '').length;
                    });
                    phone = uniquePhones[0];
                    
                    // If multiple good phones, join them
                    if (uniquePhones.length > 1) {
                        phone = uniquePhones.slice(0, 3).join(', ');
                    }
                }
            }
        }

        // Email Addresses - More thorough extraction
        if (container) {
            var allEmails = [];
            
            // 1. Check for mailto links first (most reliable)
            var emailLinks = container.querySelectorAll('a[href^="mailto:"]');
            emailLinks.forEach(link => {
                var email = link.href.replace('mailto:', '').toLowerCase().trim();
                if (email && email.includes('@') && email.includes('.')) {
                    allEmails.push(email);
                }
            });
            
            // 2. Check for email elements with specific classes/attributes
            var emailElements = container.querySelectorAll('[data-value*="email"], [data-value*="mail"], .email, .mail, [class*="email"], [class*="mail"]');
            emailElements.forEach(el => {
                var text = el.textContent || el.getAttribute('data-value') || '';
                var emailMatches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
                if (emailMatches) {
                    allEmails = allEmails.concat(emailMatches.map(e => e.toLowerCase().trim()));
                }
            });
            
            // 3. Search in all text content with improved regex
            var containerText = container.textContent || '';
            var emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
            var emailMatches = containerText.match(emailRegex);
            
            if (emailMatches && emailMatches.length > 0) {
                allEmails = allEmails.concat(emailMatches.map(e => e.toLowerCase().trim()));
            }
            
            // 4. Check for hidden or encoded emails
            var allElements = container.querySelectorAll('*');
            allElements.forEach(el => {
                var innerHTML = el.innerHTML || '';
                // Look for encoded emails (common obfuscation)
                var encodedEmails = innerHTML.match(/[a-zA-Z0-9._%+-]+&#64;[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
                if (encodedEmails) {
                    var decoded = encodedEmails.map(e => e.replace('&#64;', '@').toLowerCase().trim());
                    allEmails = allEmails.concat(decoded);
                }
            });
            
            // Clean and deduplicate emails
            if (allEmails.length > 0) {
                var uniqueEmails = [...new Set(allEmails)].filter(e => {
                    // More strict email validation
                    return e.includes('@') && 
                           e.includes('.') && 
                           e.length > 5 && 
                           e.length < 100 &&
                           !e.includes(' ') &&
                           e.split('@').length === 2 &&
                           e.split('@')[1].includes('.');
                });
                
                email = uniqueEmails.join(', ');
            }
        }

        // Business Hours - More precise extraction
        if (container) {
            var containerText = container.textContent || '';
            
            // Look for hours in specific elements first
            var hoursElements = container.querySelectorAll('[data-value*="hour"], [data-value*="time"], .hours, .schedule, [class*="hour"], [class*="time"]');
            var hoursTexts = [];
            
            hoursElements.forEach(el => {
                var text = el.textContent || el.getAttribute('data-value') || '';
                if (text && text.length > 5 && text.length < 100) {
                    hoursTexts.push(text);
                }
            });
            
            // More specific hours patterns
            var hoursPatterns = [
                // Time patterns: "9:00 AM - 6:00 PM", "9-18", "9:00-18:00"
                /\d{1,2}[:\.]?\d{0,2}\s*(AM|PM|am|pm)?\s*[-–—]\s*\d{1,2}[:\.]?\d{0,2}\s*(AM|PM|am|pm)?/g,
                // Day patterns: "Mon-Fri 9-18", "Monday to Friday 9-18"
                /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[\s\-]*\w*\s*\d{1,2}[:\.]?\d{0,2}\s*[-–—]\s*\d{1,2}[:\.]?\d{0,2}/g,
                // Status patterns: "Open now", "Closed", "Abre a las 3 pm"
                /(?:Open|Closed|Abre|Cierra|Abierto|Cerrado)[\s\w]*\d{1,2}[:\.]?\d{0,2}\s*(AM|PM|am|pm)?/g
            ];
            
            var hoursMatches = [];
            
            // First check specific hours elements
            hoursTexts.forEach(text => {
                hoursPatterns.forEach(pattern => {
                    var matches = text.match(pattern);
                    if (matches) {
                        hoursMatches = hoursMatches.concat(matches);
                    }
                });
            });
            
            // Then check container text
            hoursPatterns.forEach(pattern => {
                var matches = containerText.match(pattern);
                if (matches) {
                    hoursMatches = hoursMatches.concat(matches);
                }
            });
            
            if (hoursMatches.length > 0) {
                // Clean and filter hours
                var cleanHours = hoursMatches
                    .map(h => h.trim())
                    .filter(h => h.length > 3 && h.length < 50)
                    .slice(0, 3); // Take first 3 matches
                
                hours = cleanHours.join('; ');
            }
        }

        // Social Media Links
        if (container) {
            var socialLinks = container.querySelectorAll('a[href*="facebook"], a[href*="instagram"], a[href*="twitter"], a[href*="linkedin"], a[href*="youtube"], a[href*="tiktok"]');
            var socialUrls = Array.from(socialLinks).map(link => link.href);
            if (socialUrls.length > 0) {
                socialMedia = socialUrls.join(', ');
            }
        }

        // Lead Scoring System (0-10 scale)
        leadScore = 0;
        
        // Contact information scoring
        if (phone) leadScore += 3;
        if (email) leadScore += 3;
        if (companyUrl) leadScore += 2;
        if (socialMedia) leadScore += 1;
        
        // Business quality scoring
        if (rating && parseFloat(rating) >= 4.0) leadScore += 1;
        if (reviewCount && parseInt(reviewCount.replace(/\D/g, '')) >= 50) leadScore += 1;
        
        // Industry relevance for web/tech services
        var techKeywords = ['restaurant', 'retail', 'shop', 'store', 'clinic', 'medical', 'dental', 'law', 'real estate', 'fitness', 'beauty', 'salon', 'spa', 'auto', 'repair', 'service'];
        var industryLower = industry.toLowerCase();
        if (techKeywords.some(keyword => industryLower.includes(keyword))) {
            leadScore += 1;
        }

        // Return the data as an object
        return {
            title: titleText,
            rating: rating,
            reviewCount: reviewCount,
            phone: phone,
            email: email,
            industry: industry,
            address: address,
            companyUrl: companyUrl,
            hours: hours,
            socialMedia: socialMedia,
            leadScore: leadScore,
            href: link.href,
        };
    });
}

// Convert the table to a CSV string
function tableToCsv(table) {
    var csv = [];
    var rows = table.querySelectorAll('tr');
    
    for (var i = 0; i < rows.length; i++) {
        var row = [], cols = rows[i].querySelectorAll('td, th');
        
        for (var j = 0; j < cols.length; j++) {
            row.push('"' + cols[j].innerText + '"');
        }
        csv.push(row.join(','));
    }
    return csv.join('\n');
}

// Convert the table to a JSON string
function tableToJson(table) {
    var data = [];
    var rows = table.querySelectorAll('tr');
    var headers = [];
    
    // Get headers from first row
    if (rows.length > 0) {
        var headerCells = rows[0].querySelectorAll('th');
        for (var i = 0; i < headerCells.length; i++) {
            headers.push(headerCells[i].textContent.trim());
        }
    }
    
    // Convert rows to objects
    for (var i = 1; i < rows.length; i++) {
        var row = {};
        var cells = rows[i].querySelectorAll('td');
        
        for (var j = 0; j < cells.length && j < headers.length; j++) {
            var header = headers[j].toLowerCase().replace(/\s+/g, '');
            row[header] = cells[j].textContent.trim();
        }
        
        data.push(row);
    }
    
    return JSON.stringify(data, null, 2);
}

// Download file to a specific folder using Chrome Downloads API
// Chrome automatically creates the folder structure if it doesn't exist
function downloadToFolder(content, filename, mimeType, folderName) {
    // Create folder path: GoogleMapsLeads/YYYY-MM-DD/filename
    // Chrome will automatically create GoogleMapsLeads and date subfolder
    var date = new Date();
    var dateFolder = date.toISOString().split('T')[0]; // YYYY-MM-DD format
    var folderPath = folderName + '/' + dateFolder + '/' + filename;
    
    console.log('Guardando en carpeta:', folderPath);
    
    // Create blob
    var blob = new Blob([content], {type: mimeType});
    var blobUrl = URL.createObjectURL(blob);
    
    // Try Chrome Downloads API first
    // This will automatically create the folder structure in Downloads folder
    chrome.downloads.download({
        url: blobUrl,
        filename: folderPath, // Relative to Downloads folder
        saveAs: false // Save directly without asking
    }, function(downloadId) {
        if (chrome.runtime.lastError) {
            console.log('Blob URL failed, trying data URL...');
            // If Chrome API fails, try with data URL
            var reader = new FileReader();
            reader.onloadend = function() {
                chrome.downloads.download({
                    url: reader.result,
                    filename: folderPath,
                    saveAs: false
                }, function(downloadId2) {
                    if (chrome.runtime.lastError) {
                        console.error('Chrome API failed, using fallback');
                        // Final fallback to traditional download
                        downloadFileFallback(content, filename, mimeType);
                    } else {
                        showNotification('✅ Archivo guardado en: Descargas/' + folderPath);
                    }
                });
            };
            reader.readAsDataURL(blob);
        } else {
            // Success - cleanup blob URL after a delay
            setTimeout(function() {
                URL.revokeObjectURL(blobUrl);
            }, 1000);
            showNotification('✅ Archivo guardado en: Descargas/' + folderPath);
        }
    });
}

// Fallback download method (if Chrome API not available)
function downloadFileFallback(content, filename, mimeType) {
    var file = new Blob([content], {type: mimeType});
    var downloadLink = document.createElement('a');
    downloadLink.download = filename;
    downloadLink.href = URL.createObjectURL(file);
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    showNotification('Archivo descargado: ' + filename);
}

// Show notification message
function showNotification(message) {
    var notification = document.createElement('div');
    notification.style.cssText = 'position: fixed; top: 10px; right: 10px; background: #28a745; color: white; padding: 12px 20px; border-radius: 8px; z-index: 10000; box-shadow: 0 4px 6px rgba(0,0,0,0.1);';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(function() {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s';
        setTimeout(function() {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}