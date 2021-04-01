import os, sys

PROJECT_DIR = '/home/joshuajnoble/w209'

activate_this = '/home/joshuajnoble/w209/bin/activate_this.py'
with open(activate_this) as file_:
    exec(file_.read(), dict(__file__=activate_this))

sys.path.append(PROJECT_DIR)

from w209 import app as application
