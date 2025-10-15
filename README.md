# Extented Filesystem extension for Claude Desktop

**Owner:** Kristian "Krisu" Virtanen\
**Purpose:** Learning and adding some neat or fun features.\
**Email:** krisu.virtanen@gmail.com\
**Help?** Yes, I would appreciate it.\
**Usage:** See HOWTO.md

---

> [!NOTE]  
> This is a modification of the Claude Desktop extension produced by Anthropic itself.\
> Unfortunately I couldn't find any working link for it.\
> See the image "ScreenShotOfOriginalOne"\
> It is MIT licensed.\
> Work continues, but I hit those darn daily limits so *good night*

---

# Current Features

## copy_file

**Description:**
- Create a copy of a file or directory.
- For files, creates an exact copy at the destination path.
- For directories, recursively copies all contents.
- If the destination already exists, the operation will fail.
- Both source and destination must be within allowed directories.
> Added by Krisu 14.10.2025


## create_directory

**Description:**
- Create a new directory or ensure a directory exists.
- Can create multiple nested directories in one operation.
- If the directory already exists, this operation will succeed silently.
- Perfect for setting up directory structures for projects\
or ensuring required paths exist. Only works within allowed directories.


## delete_file

**Description:**
- Place **Trash** folder in your root!
- Safely delete a file or directory by moving it to /Trash.
- This acts like a recycle bin.
- Files aren't permanently deleted and can be recovered.
- If a file with the same name exists in trash, a timestamp is appended.
- Works for both files and directories.
- Only works within allowed directories.
> Added by Krisu 14.10.2025


## directory_tree

**Description:**
- Get a recursive tree view of files and directories as a JSON structure.
- Each entry includes 'name', 'type' (file/directory), and 'children' for\
directories.
- Files have no children array, while directories always have a children array (which may be empty).
- The output is formatted with 2-space indentation for readability.
- Only works within allowed directories.


## edit_file

**Description:**
- Make line-based edits to a text file.
- Each edit replaces exact line sequences with new content.
- Returns a git-style diff showing the changes made.
- Only works within allowed directories.


## get_dotnet_info

**Description:**
- Returns detailed .NET SDK and runtime information including installed versions and environment details.
> Added by Krisu 15.10.2025


## get_drive_info

**Description:**
- Provides data on the size of the disk space and the space used.
> Added by Krisu 14.10.2025


## get_file_info

**Description:**
- Retrieve detailed metadata about a file or directory.
- Returns comprehensive information including\
size, creation time, last modified time, permissions, and type.
- This tool is perfect for understanding file characteristics\
without reading the actual content.
- Only works within allowed directories.


## get_freebasic_version

**Description:**
- Checks whether FreeBASIC compiler (fbc64) is installed and returns the version number.
> Added by Krisu 15.10.2025


## get_git_version

**Description:**
- Checks whether Git version control is installed and returns the version number.
> Added by Krisu 15.10.2025


## get_local_time

**Description:**
- Get the current local system time with date and timezone information.
- Returns a formatted timestamp of the current moment.
- Example: [timestamp format='Day DD-MM-YYYY HH:MM' timezone='Finland'\
 value='Wednesday 15-10-2025 02:21'/]
 > Added by Krisu 14.10.2025


## get_network_info

**Description:**
- Get network configuration using ipconfig (Windows) or ifconfig (Linux/Mac).\
- Returns network adapter details, IP addresses, subnet masks, and gateway\
 information.
> Added by Krisu 14.10.2025


## get_node_version

**Description:**
- Checks whether Node.js is installed and returns the version number.
> Added by Krisu 15.10.2025


## get_npm_global_packages

**Description:**
- Lists all globally installed npm packages with their version numbers and dependencies.
> Added by Krisu 15.10.2025


## get_npm_project_packages

**Description:**
- Lists all npm packages installed in the current project directory with their version numbers and dependencies.
> Added by Krisu 15.10.2025


## get_npm_version

**Description:**
- Checks whether npm (Node Package Manager) is installed and returns the version number.
> Added by Krisu 15.10.2025


## get_nvidia_smi

**Description:**
- Get detailed NVIDIA GPU information using nvidia-smi command.
- Returns GPU model, memory usage, temperature, driver version\
and current utilization.
- Only works on systems with NVIDIA GPUs and drivers installed.
> Added by Krisu 15.10.2025


## get_pip_packages

**Description:**
- Lists all Python packages installed via pip with their version numbers.
> Added by Krisu 15.10.2025


## get_pip_version

**Description:**
- Checks whether pip (Python package installer) is installed and returns the version number.
> Added by Krisu 15.10.2025


## get_python_version

**Description:**
- Checks whether Python is installed and if so, returns the version number.
> Added by Krisu 15.10.2025


## get_sqlite3_version

**Description:**
- Checks whether SQLite3  is installed and if so, returns the version number.
> Added by Krisu 15.10.2025


## get_system_info

**Description:**
- Get CPU and RAM information including
- processor model
- core count
- clock speed
- total memory
- available memory
- and current memory usage statistics.
> Added by Krisu 15.10.2025


## list_allowed_directories

**Description:**
- Returns the list of directories that this server is allowed to access.
- Use this to understand which directories are available before trying to access files.


## list_directory

**Description:**
- Get a detailed listing of all files and directories in a specified path.
- Results clearly distinguish between files and directories with\
[FILE] and [DIR] prefixes.
- This tool is essential for understanding directory structure and\
finding specific files within a directory.
- Only works within allowed directories.",


## move_file

**Description:**
- Move or rename files and directories.
- Can move files between directories "and rename them in a single operation.
- If the destination exists, the operation will fail.
- Works across different directories and can be used for simple renaming\
within the same directory.
- Both source and destination must be within allowed directories.


## read_multiple_files

**Description:**
- Read the contents of multiple files simultaneously.
- This is more efficient than reading files one by one\
when you need to analyze or compare multiple files.
- Each file's content is returned with its path as a reference.
- Failed reads for individual files won't stop "the entire operation.
- Only works within allowed directories.",


## search_files

**Description:**
- Recursively search for files and directories matching a pattern.
- Searches through all subdirectories from the starting path.
- The search is case-insensitive and matches partial names.
- Returns full paths to all matching items.
- Great for finding files when you don't know their exact location.
- Only searches within allowed directories.


## write_file

**Description:**
- Create a new file or completely overwrite an existing file with new content.
- Use with caution as it will overwrite existing files without warning.
- Handles text content with proper encoding.
- Only works within allowed directories.
