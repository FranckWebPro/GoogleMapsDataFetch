export function camelToTitleCase(text: string): string {
    // Handle simple acronyms like NFC
    text = text.replace(/NFC/g, 'NFC'); 
    
    const result = text.replace(/([A-Z])/g, " $1");
    return result.charAt(0).toUpperCase() + result.slice(1);
  }

  export function toSlug(name: string): string {
    const slug = name
      .toLowerCase() // Convert to lowercase
      .replace(/\W+/g, "-") // Replace non-word characters with hyphens
      .replace(/^-+|-+$/g, "")
      .slice(0, 100); // Trim leading and trailing hyphens
  
    if (slug.endsWith("-")) {
      return slug.slice(0, -1);
    }
  
    return slug;
  }